/**
 * Estudios que reutilizan el ensamblaje estático: modal, P-Delta, pandeo e
 * influencia. Todos trabajan en perfil con las mismas ecuaciones reducidas
 * (diafragmas incluidos) que el cálculo lineal: ninguna matriz densa.
 *
 *   · Modal: `K·φ = ω²·M·φ` con Lanczos y verificación de Sturm; la masa sale
 *     de la fuente de masa del proyecto.
 *   · Pandeo: `K·φ = λ·K_G·φ` con la rigidez geométrica de las barras
 *     comprimidas bajo el objetivo.
 *   · P-Delta: `(K − K_G(u))·u = F` iterado hasta que `u` deja de cambiar.
 */
import { multiply, transpose, zeros, multiplyMatrixVector, type Matrix } from '../../../../foundation/linearAlgebra';
import { smallestGeneralizedEigenpairs, type Space3DEigenpair } from './eigenSolvers';
import { expandSpace3DVector, reduceSpace3DVector, scatterSpace3DDiagonal, scatterSpace3DElement } from './equations';
import { assembleSpace3DMassDistribution, type Space3DMassDistribution } from './mass';
import {
  cloneSkyline,
  countSkylineNegativePivots,
  createSkylineMatrix,
  factorizeSkyline,
  multiplySkyline,
  Space3DSingularMatrixError,
  type Space3DSkylineFactorization,
  type Space3DSkylineMatrix,
} from './skylineSolver';
import {
  analyzeSpace3DProject,
  assembleSpace3DSkylineStiffness,
  assembleSpace3DStaticModel,
  recoverSpace3DResult,
  space3DElementStiffnessProduct,
  space3DMechanismIssue,
  space3DReducedStiffnessProduct,
  withStoryResponse,
  type Space3DStaticAnalysisOptions,
  type Space3DStaticAssembly,
  type Space3DStaticAssemblyElement,
} from './solver';
import type {
  Space3DAnalysisIssue,
  Space3DAnalysisResult,
  Space3DDofValues,
  Space3DProjectV1,
  Space3DVector,
} from '../model/types';

const DOF_PER_NODE = 6;

const vectorNorm = (values: readonly number[]): number => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

interface Space3DModalOptions extends Space3DStaticAnalysisOptions {
  readonly targetId?: string;
  readonly modes?: number;
  readonly maxIterations?: number;
  readonly tolerance?: number;
}

interface Space3DModalMode {
  readonly angularFrequency: number;
  readonly frequency: number;
  readonly period: number;
  readonly participatingMassRatioX: number;
  readonly participatingMassRatioY: number;
  readonly participatingMassRatioZ: number;
  readonly shape: readonly (Space3DDofValues & { readonly nodeId: string })[];
}

interface Space3DModalResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly modes: readonly Space3DModalMode[];
  readonly totalMass: number;
  /** Masa traslacional por dirección X, Y, Z, t. */
  readonly totalMassByDirection: Space3DVector;
  /** De dónde salió la masa, t. */
  readonly massBreakdown: { readonly self: number; readonly nodal: number; readonly loads: number };
  readonly converged: boolean;
  /** La cuenta de Sturm confirma que no falta ningún modo por debajo del último. */
  readonly sturmVerified: boolean;
  readonly residual: number;
  readonly freeDegreesOfFreedom: number;
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly reason: string;
}

const failure = (
  targetId: string,
  reason: string,
  issues: readonly Space3DAnalysisIssue[] = [],
  totalMass = 0,
  freeDegreesOfFreedom = 0,
): Space3DModalResult => Object.freeze({
  success: false,
  targetId,
  modes: Object.freeze([]),
  totalMass,
  totalMassByDirection: Object.freeze([0, 0, 0]) as Space3DVector,
  massBreakdown: Object.freeze({ self: 0, nodal: 0, loads: 0 }),
  converged: false,
  sturmVerified: false,
  residual: Number.NaN,
  freeDegreesOfFreedom,
  issues: Object.freeze([...issues]),
  reason,
});

const targetForModal = (project: Space3DProjectV1, requested?: string): string =>
  requested ?? project.loadCombinations[0]?.id ?? project.loadCases[0]?.id ?? '';

type Factored =
  | { readonly ok: true; readonly matrix: Space3DSkylineMatrix; readonly factorization: Space3DSkylineFactorization }
  | { readonly ok: false; readonly issue: Space3DAnalysisIssue };

/** Rigidez reducida (más un término por barra) factorizada; la copia sin factorizar sirve para Sturm. */
const factorStiffness = (
  project: Space3DProjectV1,
  assembly: Space3DStaticAssembly,
  extra?: (element: Space3DStaticAssemblyElement) => Matrix | null,
): Factored => {
  const matrix = assembleSpace3DSkylineStiffness(assembly, extra);
  const pristine = cloneSkyline(matrix);
  try {
    return { ok: true, matrix: pristine, factorization: factorizeSkyline(matrix) };
  } catch (error) {
    if (!(error instanceof Space3DSingularMatrixError)) throw error;
    return { ok: false, issue: space3DMechanismIssue(project, assembly, error.row) };
  }
};

/** Número de autovalores de `K − σ·B` por debajo de σ; los dos perfiles son el mismo. */
const sturmCounter = (stiffness: Space3DSkylineMatrix, weight: Space3DSkylineMatrix) => (sigma: number): number | null => {
  const shifted = cloneSkyline(stiffness);
  for (let index = 0; index < shifted.values.length; index += 1) shifted.values[index] -= sigma * weight.values[index];
  return countSkylineNegativePivots(shifted);
};

/** Filas con término diagonal positivo: cota del rango de `B`. */
const positiveDiagonalCount = (matrix: Space3DSkylineMatrix): number => {
  let count = 0;
  for (let row = 0; row < matrix.n; row += 1) if (matrix.values[matrix.offset[row + 1] - 1] > 0) count += 1;
  return count;
};

/** Modos del proyecto en ecuaciones reducidas; lo comparten el modal y el espectro. */
interface Space3DModalBasis {
  readonly assembly: Space3DStaticAssembly;
  readonly mass: Space3DMassDistribution;
  readonly pairs: readonly Space3DEigenpair[];
  readonly converged: boolean;
  readonly sturmVerified: boolean;
}

type Space3DModalBasisOutcome =
  | ({ readonly ok: true } & Space3DModalBasis)
  | { readonly ok: false; readonly result: Space3DModalResult };

export const computeSpace3DModalBasis = (project: Space3DProjectV1, options: Space3DModalOptions = {}): Space3DModalBasisOutcome => {
  const targetId = targetForModal(project, options.targetId);
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  if (!assembly.valid) return { ok: false, result: failure(targetId, 'El ensamblaje espacial no es admisible para el estudio modal.', assembly.issues) };
  const n = assembly.equations.count;
  if (n === 0) return { ok: false, result: failure(targetId, 'Las condiciones de contorno no dejan grados de libertad libres.', [], 0, 0) };

  const mass = assembleSpace3DMassDistribution(project, assembly);
  const totalMass = Math.max(...mass.total);
  if (!(totalMass > 0)) return { ok: false, result: failure(targetId, 'El modelo no declara masa: ni masa propia, ni masas nodales, ni cargas en la fuente de masa.', [], 0, n) };

  const stiffness = factorStiffness(project, assembly);
  if (!stiffness.ok) return { ok: false, result: failure(targetId, 'La rigidez es singular: hay un mecanismo.', [stiffness.issue], totalMass, n) };
  const massMatrix = createSkylineMatrix(assembly.equations.firstColumn);
  mass.diagonal.forEach((value, dof) => { if (value > 0) scatterSpace3DDiagonal(assembly.equations, massMatrix, dof, value); });
  const rank = positiveDiagonalCount(massMatrix);
  const count = Math.max(1, Math.min(Math.trunc(options.modes ?? 5), rank));
  if (rank === 0) return { ok: false, result: failure(targetId, 'La masa cae toda en GDL restringidos.', [], totalMass, n) };

  const eigen = smallestGeneralizedEigenpairs({
    n,
    solve: (rhs) => stiffness.factorization.solve(rhs),
    applyB: (vector) => multiplySkyline(massMatrix, vector),
    count,
    sturmCount: sturmCounter(stiffness.matrix, massMatrix),
    tolerance: options.tolerance,
  });
  if (eigen.pairs.length === 0) return { ok: false, result: failure(targetId, 'Lanczos no encontró ningún modo con masa.', [], totalMass, n) };
  return { ok: true, assembly, mass, pairs: eigen.pairs, converged: eigen.converged, sturmVerified: eigen.sturmVerified };
};

/** Forma normalizada a la mayor traslación, para dibujarla. */
const normalizedShape = (project: Space3DProjectV1, full: readonly number[]) => {
  const peak = project.nodes.reduce((maximum, _node, nodeIndex) => {
    const base = nodeIndex * DOF_PER_NODE;
    return Math.max(maximum, Math.abs(full[base]), Math.abs(full[base + 1]), Math.abs(full[base + 2]));
  }, 0);
  const scale = peak > 0 ? 1 / peak : 1;
  return Object.freeze(project.nodes.map((node, nodeIndex) => {
    const base = nodeIndex * DOF_PER_NODE;
    return Object.freeze({
      nodeId: node.id,
      ux: full[base] * scale,
      uy: full[base + 1] * scale,
      uz: full[base + 2] * scale,
      rx: full[base + 3] * scale,
      ry: full[base + 4] * scale,
      rz: full[base + 5] * scale,
    });
  }));
};

/** Factor de participación `Γ = φᵀ·M·r` para una traslación unitaria en `axis`. */
export const space3DParticipation = (mass: Space3DMassDistribution, full: readonly number[], axis: 0 | 1 | 2): number => {
  let sum = 0;
  for (let dof = axis; dof < full.length; dof += DOF_PER_NODE) sum += mass.diagonal[dof] * full[dof];
  return sum;
};

/**
 * Masa que puede moverse en cada dirección: la de los GDL libres o esclavos
 * de un diafragma (una traslación rígida siempre es compatible con ellos).
 */
export const space3DParticipatingMass = (assembly: Space3DStaticAssembly, mass: Space3DMassDistribution): [number, number, number] => {
  const totals: [number, number, number] = [0, 0, 0];
  for (let dof = 0; dof < assembly.totalDofs; dof += 1) {
    const axis = dof % DOF_PER_NODE;
    if (axis > 2) continue;
    if (assembly.equations.position[dof] >= 0 || assembly.equations.slaves.has(dof)) totals[axis] += mass.diagonal[dof];
  }
  return totals;
};

export const analyzeSpace3DModal = (
  project: Space3DProjectV1,
  options: Space3DModalOptions = {},
): Space3DModalResult => {
  const targetId = targetForModal(project, options.targetId);
  const basis = computeSpace3DModalBasis(project, options);
  if (!basis.ok) return basis.result;
  const { assembly, mass } = basis;
  // La masa de los GDL restringidos no participa: la base se mueve con el suelo.
  const participating = space3DParticipatingMass(assembly, mass);
  let residual = 0;
  const modes = basis.pairs.map((pair): Space3DModalMode => {
    const full = expandSpace3DVector(assembly.equations, pair.vector);
    residual = Math.max(residual, pair.bound);
    const ratios = ([0, 1, 2] as const).map((axis) => {
      const gamma = space3DParticipation(mass, full, axis);
      return participating[axis] > 0 ? (gamma * gamma) / participating[axis] : 0;
    });
    const omega = Math.sqrt(pair.value);
    return Object.freeze({
      angularFrequency: omega,
      frequency: omega / (2 * Math.PI),
      period: omega > 0 ? 2 * Math.PI / omega : Number.POSITIVE_INFINITY,
      participatingMassRatioX: ratios[0],
      participatingMassRatioY: ratios[1],
      participatingMassRatioZ: ratios[2],
      shape: normalizedShape(project, full),
    });
  });

  return Object.freeze({
    success: true,
    targetId,
    modes: Object.freeze(modes),
    totalMass: Math.max(...mass.total),
    totalMassByDirection: Object.freeze([...mass.total]) as unknown as Space3DVector,
    massBreakdown: Object.freeze({ self: mass.fromSelf, nodal: mass.fromNodal, loads: mass.fromLoads }),
    converged: basis.converged,
    sturmVerified: basis.sturmVerified,
    residual,
    freeDegreesOfFreedom: assembly.equations.count,
    issues: Object.freeze([]),
    reason: basis.sturmVerified
      ? `${modes.length} modos; la cuenta de Sturm confirma que no falta ninguno.`
      : `${modes.length} modos; la cuenta de Sturm no pudo confirmarlos.`,
  });
};

interface Space3DPDeltaOptions extends Space3DStaticAnalysisOptions {
  readonly maxIterations?: number;
  readonly tolerance?: number;
}

interface Space3DPDeltaResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly linear: Space3DAnalysisResult;
  readonly analysis: Space3DAnalysisResult;
  readonly iterations: number;
  readonly converged: boolean;
  readonly residual: number;
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly reason: string;
}

interface Space3DBucklingMode {
  readonly criticalLoadFactor: number;
  readonly shape: readonly (Space3DDofValues & { readonly nodeId: string })[];
}

interface Space3DBucklingResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly modes: readonly Space3DBucklingMode[];
  readonly criticalLoadFactor?: number;
  readonly referenceAxialForces: Readonly<Record<string, number>>;
  readonly converged: boolean;
  readonly sturmVerified: boolean;
  readonly residual: number;
  readonly freeDegreesOfFreedom: number;
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly reason: string;
}

const pDeltaFailure = (
  targetId: string,
  reason: string,
  linear: Space3DAnalysisResult,
  issues: readonly Space3DAnalysisIssue[] = [],
): Space3DPDeltaResult => Object.freeze({
  success: false,
  targetId,
  linear,
  analysis: linear,
  iterations: 0,
  converged: false,
  residual: Number.NaN,
  issues: Object.freeze([...issues]),
  reason,
});

const bucklingFailure = (
  targetId: string,
  reason: string,
  issues: readonly Space3DAnalysisIssue[] = [],
  referenceAxialForces: Readonly<Record<string, number>> = {},
  freeDegreesOfFreedom = 0,
): Space3DBucklingResult => Object.freeze({
  success: false,
  targetId,
  modes: Object.freeze([]),
  referenceAxialForces,
  converged: false,
  sturmVerified: false,
  residual: Number.NaN,
  freeDegreesOfFreedom,
  issues: Object.freeze([...issues]),
  reason,
});

const localGeometricStiffness = (length: number, compression: number): Matrix => {
  const result = zeros(12, 12);
  if (!(compression > 0) || !(length > 0)) return result;
  const coefficient = compression / (30 * length);
  // En el plano x–z el giro ry tiene el signo contrario a w' (como en la
  // rigidez elástica): los términos que acoplan traslación y giro cambian de
  // signo. Sin eso el pandeo alrededor del eje local y sale mal.
  const scaledBlock = (indices: readonly [number, number, number, number], sign: 1 | -1) => {
    const block: readonly (readonly number[])[] = [
      [36, 3 * length, -36, 3 * length],
      [3 * length, 4 * length * length, -3 * length, -length * length],
      [-36, -3 * length, 36, -3 * length],
      [3 * length, -length * length, -3 * length, 4 * length * length],
    ];
    const rotation = (index: number) => index === 1 || index === 3;
    indices.forEach((row, i) => indices.forEach((column, j) => {
      const coupling = rotation(i) !== rotation(j) ? sign : 1;
      result[row][column] += coefficient * coupling * block[i][j];
    }));
  };
  scaledBlock([1, 5, 7, 11], 1);
  scaledBlock([2, 4, 8, 10], -1);
  return result;
};

const chordGeometricStiffness = (length: number, compression: number): Matrix => {
  const result = zeros(12, 12);
  if (!(compression > 0) || !(length > 0)) return result;
  const coefficient = compression / length;
  for (const [a, b] of [[1, 7], [2, 8]] as const) {
    result[a][a] += coefficient; result[b][b] += coefficient;
    result[a][b] -= coefficient; result[b][a] -= coefficient;
  }
  return result;
};

/**
 * Rigidez geométrica global de cada barra comprimida bajo un campo de
 * desplazamientos (las traccionadas no rigidizan: criterio conservador).
 */
const geometricFromDisplacement = (
  assembly: Space3DStaticAssembly,
  displacement: readonly number[],
): { matrices: Map<string, Matrix>; axialForces: Map<string, number> } => {
  const matrices = new Map<string, Matrix>();
  const axialForces = new Map<string, number>();
  for (const element of assembly.elements) {
    const uElement = element.dofIndices.map((index) => displacement[index] ?? 0);
    const localDisplacement = multiplyMatrixVector(element.transformation, uElement);
    const localForces = multiplyMatrixVector(element.localStiffness, localDisplacement)
      .map((value, index) => value + (element.fixedEndForces[index] ?? 0));
    const axial = ((localForces[6] ?? 0) - (localForces[0] ?? 0)) / 2;
    axialForces.set(element.memberId, axial);
    if (!(axial < 0)) continue;
    // Una armadura o una barra con flexión liberada no transmite giro: su
    // rigidez geométrica es la de la cuerda, N/L sobre las traslaciones.
    const localGeometric = element.kind === 'truss' || element.element.condensation
      ? chordGeometricStiffness(element.length, -axial)
      : localGeometricStiffness(element.length, -axial);
    matrices.set(element.memberId, multiply(transpose(element.transformation), multiply(localGeometric, element.transformation)));
  }
  return { matrices, axialForces };
};

const negated = (matrix: Matrix): Matrix => matrix.map((row) => row.map((value) => -value));

const displacementOf = (project: Space3DProjectV1, result: Space3DAnalysisResult): number[] => project.nodes.flatMap((_, index) => {
  const node = result.nodeResults[index];
  return node ? [node.displacement.ux, node.displacement.uy, node.displacement.uz, node.displacement.rx, node.displacement.ry, node.displacement.rz] : [0, 0, 0, 0, 0, 0];
});

export const analyzeSpace3DPDelta = (
  project: Space3DProjectV1,
  targetId: string,
  options: Space3DPDeltaOptions = {},
): Space3DPDeltaResult => {
  const linear = analyzeSpace3DProject(project, targetId, options);
  if (!linear.success) return pDeltaFailure(targetId, 'El análisis lineal de referencia no es válido.', linear, linear.issues);
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  const maxIterations = Math.max(1, Math.trunc(options.maxIterations ?? 20));
  const tolerance = options.tolerance ?? 1e-7;
  const rhs = reduceSpace3DVector(assembly.equations, assembly.loadVector);
  let displacement = displacementOf(project, linear);
  let geometric = new Map<string, Matrix>();
  let converged = false;
  let iterations = 0;
  for (iterations = 1; iterations <= maxIterations; iterations += 1) {
    geometric = geometricFromDisplacement(assembly, displacement).matrices;
    const current = geometric;
    const tangent = factorStiffness(project, assembly, (element) => {
      const matrix = current.get(element.memberId);
      return matrix ? negated(matrix) : null;
    });
    if (!tangent.ok) {
      return pDeltaFailure(targetId, 'Con la compresión actual la estructura pierde rigidez: la carga supera la crítica de pandeo.', linear, [tangent.issue]);
    }
    const next = expandSpace3DVector(assembly.equations, tangent.factorization.solve(rhs));
    const difference = vectorNorm(next.map((value, index) => value - displacement[index]));
    const scale = Math.max(1e-12, vectorNorm(next));
    displacement = next;
    if (difference <= tolerance * scale) { converged = true; break; }
  }
  const finalGeometric = geometric;
  // Reacciones con la rigidez tangente: (K − K_G)·u − F en los apoyos.
  const product = (u: readonly number[]): number[] => {
    const result = space3DElementStiffnessProduct(assembly, u);
    for (const element of assembly.elements) {
      const matrix = finalGeometric.get(element.memberId);
      if (!matrix) continue;
      const local = element.dofIndices.map((index) => u[index] ?? 0);
      element.dofIndices.forEach((row, i) => {
        let sum = 0;
        for (let j = 0; j < 12; j += 1) sum += matrix[i][j] * local[j];
        result[row] -= sum;
      });
    }
    return result;
  };
  const reducedResidual = (() => {
    const applied = reduceSpace3DVector(assembly.equations, product(displacement));
    let numerator = 0;
    let denominator = 0;
    for (let row = 0; row < rhs.length; row += 1) {
      numerator = Math.max(numerator, Math.abs(applied[row] - rhs[row]));
      denominator = Math.max(denominator, Math.abs(rhs[row]));
    }
    return denominator > 0 ? numerator / denominator : numerator;
  })();
  const analysis = withStoryResponse(
    project,
    recoverSpace3DResult(project, assembly, product, displacement, { relativeResidual: reducedResidual, conditionEstimate: linear.diagnostics.conditionEstimate }, options),
    displacement,
    assembly.loadVector,
  );
  return Object.freeze({
    success: converged,
    targetId,
    linear,
    analysis,
    iterations,
    converged,
    residual: analysis.diagnostics.relativeResidual,
    issues: Object.freeze(converged ? [] : [{ code: 'non-finite-solution' as const, entityKind: 'project' as const, entityId: '', field: '' }]),
    reason: converged ? `Convergió en ${iterations} iteraciones.` : `No convergió en ${maxIterations} iteraciones.`,
  });
};

export const analyzeSpace3DBuckling = (
  project: Space3DProjectV1,
  targetId: string,
  options: Space3DModalOptions = {},
): Space3DBucklingResult => {
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  if (!assembly.valid) return bucklingFailure(targetId, 'El ensamblaje espacial no es admisible para pandeo.', assembly.issues);
  const reference = analyzeSpace3DProject(project, targetId, options);
  if (!reference.success) return bucklingFailure(targetId, 'El análisis lineal de referencia no es válido para pandeo.', reference.issues);
  const geometric = geometricFromDisplacement(assembly, displacementOf(project, reference));
  const referenceAxialForces = Object.fromEntries(geometric.axialForces);
  const n = assembly.equations.count;
  if (geometric.matrices.size === 0) return bucklingFailure(targetId, 'Ningún miembro está comprimido bajo esta combinación.', [], referenceAxialForces, n);
  const stiffness = factorStiffness(project, assembly);
  if (!stiffness.ok) return bucklingFailure(targetId, 'La rigidez es singular: hay un mecanismo.', [stiffness.issue], referenceAxialForces, n);
  const geometricMatrix = createSkylineMatrix(assembly.equations.firstColumn);
  for (const element of assembly.elements) {
    const matrix = geometric.matrices.get(element.memberId);
    if (matrix) scatterSpace3DElement(assembly.equations, geometricMatrix, element.dofIndices, matrix);
  }
  const eigen = smallestGeneralizedEigenpairs({
    n,
    solve: (rhs) => stiffness.factorization.solve(rhs),
    applyB: (vector) => multiplySkyline(geometricMatrix, vector),
    count: Math.max(1, Math.min(Math.trunc(options.modes ?? 3), positiveDiagonalCount(geometricMatrix))),
    sturmCount: sturmCounter(stiffness.matrix, geometricMatrix),
    tolerance: options.tolerance,
  });
  if (eigen.pairs.length === 0) return bucklingFailure(targetId, 'No se encontró ningún modo de pandeo.', [], referenceAxialForces, n);
  const modes = eigen.pairs.map((pair) => Object.freeze({
    criticalLoadFactor: pair.value,
    shape: normalizedShape(project, expandSpace3DVector(assembly.equations, pair.vector)),
  }));
  return Object.freeze({
    success: true,
    targetId,
    modes: Object.freeze(modes),
    criticalLoadFactor: modes[0].criticalLoadFactor,
    referenceAxialForces,
    converged: eigen.converged,
    sturmVerified: eigen.sturmVerified,
    residual: Math.max(...eigen.pairs.map((pair) => pair.bound)),
    freeDegreesOfFreedom: n,
    issues: Object.freeze([]),
    reason: eigen.sturmVerified ? 'Factores verificados con la cuenta de Sturm.' : 'La cuenta de Sturm no pudo confirmar los factores.',
  });
};

type Space3DInfluenceQuantity = 'N' | 'Vy' | 'Vz' | 'T' | 'My' | 'Mz';

interface Space3DInfluenceTarget {
  readonly kind: 'member';
  readonly memberId: string;
  /** Cut coordinate on the deformable member, measured from end i. */
  readonly position: number;
  readonly quantity: Space3DInfluenceQuantity;
  readonly side: 'left' | 'right' | 'continuous';
}

interface Space3DInfluenceOptions extends Space3DStaticAnalysisOptions {
  readonly targetId: string;
  readonly target: Space3DInfluenceTarget;
  /** Positions of the moving unit load on the same member path. */
  readonly positions: readonly number[];
  /** Explicit global direction; V1's unsigned `V/M/R` fields are not inferred. */
  readonly unitLoad: Space3DVector;
}

interface Space3DInfluencePoint {
  readonly position: number;
  readonly value: number;
  readonly equilibriumResidual: number;
  readonly analysis: Space3DAnalysisResult;
}

interface Space3DInfluenceResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly target: Space3DInfluenceTarget;
  readonly points: readonly Space3DInfluencePoint[];
  readonly maxEquilibriumResidual: number;
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly reason: string;
}

const influenceFailure = (
  targetId: string,
  target: Space3DInfluenceTarget,
  reason: string,
  issues: readonly Space3DAnalysisIssue[] = [],
): Space3DInfluenceResult => Object.freeze({
  success: false,
  targetId,
  target,
  points: Object.freeze([]),
  maxEquilibriumResidual: Number.NaN,
  issues: Object.freeze([...issues]),
  reason,
});

const evaluateInfluenceQuantity = (
  result: Space3DAnalysisResult,
  target: Space3DInfluenceTarget,
  length: number,
): number => {
  const member = result.memberResults.find((candidate) => candidate.memberId === target.memberId);
  if (!member) return Number.NaN;
  const ratio = length > 0 ? Math.max(0, Math.min(1, target.position / length)) : 0;
  const start = member.start[target.quantity];
  const end = member.end[target.quantity];
  if (target.side === 'left') return start + ratio * (end - start);
  if (target.side === 'right') return end - (1 - ratio) * (end - start);
  return (start + end) / 2;
};

/**
 * Respuesta de influencia para una carga unitaria espacial explícita. La carga
 * móvil se proyecta a los dos extremos mediante funciones lineales; cada punto
 * vuelve a resolver el mismo K y publica el residual de equilibrio. Las
 * posiciones no se limitan artificialmente, pero deben pertenecer al miembro.
 */
export const analyzeSpace3DInfluence = (
  project: Space3DProjectV1,
  options: Space3DInfluenceOptions,
): Space3DInfluenceResult => {
  const { target, targetId } = options;
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  if (!assembly.valid) return influenceFailure(targetId, target, 'El ensamblaje espacial no es admisible para influencia.', assembly.issues);
  const element = assembly.elements.find((candidate) => candidate.memberId === target.memberId);
  if (!element) return influenceFailure(targetId, target, 'El miembro objetivo no existe en la asamblea.', [{ code: 'missing-reference', entityKind: 'member', entityId: target.memberId, field: 'memberId' }]);
  if (!Number.isFinite(target.position) || target.position < 0 || target.position > element.length) {
    return influenceFailure(targetId, target, 'La posición del corte está fuera del tramo deformable.', [{ code: 'invalid-property', entityKind: 'member', entityId: target.memberId, field: 'position' }]);
  }
  if (!options.unitLoad.every((component) => Number.isFinite(component)) || Math.hypot(...options.unitLoad) === 0) {
    return influenceFailure(targetId, target, 'La dirección de la carga unitaria debe ser finita y no nula.', [{ code: 'invalid-property', entityKind: 'project', entityId: project.id, field: 'unitLoad' }]);
  }
  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  const startIndex = nodeIndex.get(element.nodeI);
  const endIndex = nodeIndex.get(element.nodeJ);
  if (startIndex === undefined || endIndex === undefined) return influenceFailure(targetId, target, 'La asamblea no tiene extremos del miembro objetivo.');
  const points: Space3DInfluencePoint[] = [];
  const stiffness = factorStiffness(project, assembly);
  if (!stiffness.ok) return influenceFailure(targetId, target, 'La rigidez es singular: hay un mecanismo.', [stiffness.issue]);
  try {
    for (const position of options.positions) {
      if (!Number.isFinite(position) || position < 0 || position > element.length) {
        return influenceFailure(targetId, target, 'Una posición de carga móvil está fuera del tramo deformable.', [{ code: 'invalid-property', entityKind: 'member', entityId: target.memberId, field: 'positions' }]);
      }
      const ratio = element.length > 0 ? position / element.length : 0;
      const loadVector = new Array<number>(assembly.totalDofs).fill(0);
      const startBase = startIndex * DOF_PER_NODE;
      const endBase = endIndex * DOF_PER_NODE;
      loadVector[startBase] += options.unitLoad[0] * (1 - ratio);
      loadVector[startBase + 1] += options.unitLoad[1] * (1 - ratio);
      loadVector[startBase + 2] += options.unitLoad[2] * (1 - ratio);
      loadVector[endBase] += options.unitLoad[0] * ratio;
      loadVector[endBase + 1] += options.unitLoad[1] * ratio;
      loadVector[endBase + 2] += options.unitLoad[2] * ratio;
      const rhs = reduceSpace3DVector(assembly.equations, loadVector);
      const reduced = stiffness.factorization.solve(rhs);
      const product = space3DReducedStiffnessProduct(assembly, reduced);
      let numerator = 0;
      let denominator = 0;
      for (let row = 0; row < rhs.length; row += 1) {
        numerator = Math.max(numerator, Math.abs(product[row] - rhs[row]));
        denominator = Math.max(denominator, Math.abs(rhs[row]));
      }
      const displacement = expandSpace3DVector(assembly.equations, reduced);
      const analysis = recoverSpace3DResult(project, assembly, null, displacement, { relativeResidual: denominator > 0 ? numerator / denominator : numerator, conditionEstimate: Number.NaN }, { loadVector });
      points.push(Object.freeze({ position, value: evaluateInfluenceQuantity(analysis, target, element.length), equilibriumResidual: analysis.diagnostics.equilibrium.normalized, analysis }));
    }
  } catch (cause) {
    return influenceFailure(targetId, target, cause instanceof Error ? `La influencia no pudo resolver el punto móvil: ${cause.message}` : 'La influencia no pudo resolver el punto móvil.');
  }
  return Object.freeze({
    success: true,
    targetId,
    target,
    points: Object.freeze(points),
    maxEquilibriumResidual: Math.max(...points.map((point) => point.equilibriumResidual), 0),
    issues: Object.freeze([]),
    reason: `Se resolvieron ${points.length} posiciones con carga unitaria explícita.`,
  });
};
