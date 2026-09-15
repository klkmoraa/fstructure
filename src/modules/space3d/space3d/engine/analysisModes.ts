/** Estudios modales espaciales sobre el ensamblaje canónico de seis GDL. */
import {
  generalizedSmallestEigenpairs,
} from '../../../../engine/eigen';
import {
  multiplyMatrixVector,
  multiply,
  solveLinearSystem,
  submatrix,
  zeros,
  transpose,
  type Matrix,
} from '../../foundation/linearAlgebra';
import {
  analyzeSpace3DStatic,
  assembleSpace3DStaticModel,
  type Space3DStaticAnalysisOptions,
} from './solver';
import type {
  Space3DAnalysisIssue,
  Space3DAnalysisResult,
  Space3DEquilibriumAudit,
  Space3DDofValues,
  Space3DMemberEndForces,
  Space3DMemberResult,
  Space3DNodeResult,
  Space3DProjectV1,
  Space3DVector,
} from '../model/types';

const KILOGRAM_TO_MEGAGRAM = 1e-3;
const DOF_PER_NODE = 6;

export interface Space3DModalOptions extends Space3DStaticAnalysisOptions {
  readonly targetId?: string;
  readonly modes?: number;
  readonly maxIterations?: number;
  readonly tolerance?: number;
}

export interface Space3DModalMode {
  readonly angularFrequency: number;
  readonly frequency: number;
  readonly period: number;
  readonly participatingMassRatioX: number;
  readonly participatingMassRatioY: number;
  readonly participatingMassRatioZ: number;
  readonly shape: readonly (Space3DDofValues & { readonly nodeId: string })[];
}

export interface Space3DModalResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly modes: readonly Space3DModalMode[];
  readonly totalMass: number;
  readonly converged: boolean;
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
  converged: false,
  residual: Number.NaN,
  freeDegreesOfFreedom,
  issues: Object.freeze([...issues]),
  reason,
});

const bilinear = (matrix: Matrix, left: readonly number[], right: readonly number[]): number =>
  multiplyMatrixVector(matrix, right).reduce((sum, value, index) => sum + left[index] * value, 0);

const addDiagonalMass = (matrix: Matrix, index: number, value: number): void => {
  if (value > 0 && Number.isFinite(value)) matrix[index][index] += value;
};

/**
 * Masa concentrada de referencia para el primer estudio espacial. La masa
 * distribuida se reparte a los extremos y la inercia rotacional equivalente
 * mantiene positiva la matriz en los seis GDL sin inventar masa si el miembro
 * no declara densidad.
 */
const assembleSpace3DMass = (project: Space3DProjectV1, assembly: ReturnType<typeof assembleSpace3DStaticModel>): { M: Matrix; totalMass: number } => {
  const M = zeros(assembly.totalDofs, assembly.totalDofs);
  let totalMass = 0;
  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));

  for (const element of assembly.elements) {
    const member = project.members.find((candidate) => candidate.id === element.memberId);
    if (!member || !(member.density && member.density > 0) || !(member.A > 0)) continue;
    const memberMass = member.density * member.A * element.length * KILOGRAM_TO_MEGAGRAM;
    if (!(memberMass > 0) || !Number.isFinite(memberMass)) continue;
    totalMass += memberMass;
    const half = memberMass / 2;
    const rotational = memberMass * element.length * element.length / 24;
    for (const nodeId of [element.nodeI, element.nodeJ]) {
      const index = nodeIndex.get(nodeId);
      if (index === undefined) continue;
      const base = index * DOF_PER_NODE;
      addDiagonalMass(M, base, half);
      addDiagonalMass(M, base + 1, half);
      addDiagonalMass(M, base + 2, half);
      addDiagonalMass(M, base + 3, rotational);
      addDiagonalMass(M, base + 4, rotational);
      addDiagonalMass(M, base + 5, rotational);
    }
  }

  for (const nodalMass of project.nodalMasses) {
    const index = nodeIndex.get(nodalMass.nodeId);
    if (index === undefined || !(nodalMass.mass > 0) || !Number.isFinite(nodalMass.mass)) continue;
    const base = index * DOF_PER_NODE;
    const translational = nodalMass.mass * KILOGRAM_TO_MEGAGRAM;
    addDiagonalMass(M, base, (nodalMass.massX ?? nodalMass.mass) * KILOGRAM_TO_MEGAGRAM);
    addDiagonalMass(M, base + 1, (nodalMass.massY ?? nodalMass.mass) * KILOGRAM_TO_MEGAGRAM);
    addDiagonalMass(M, base + 2, (nodalMass.massZ ?? nodalMass.mass) * KILOGRAM_TO_MEGAGRAM);
    const inertia = nodalMass.rotationalInertia !== undefined
      ? nodalMass.rotationalInertia * KILOGRAM_TO_MEGAGRAM
      : 0;
    addDiagonalMass(M, base + 3, nodalMass.inertiaX !== undefined ? nodalMass.inertiaX * KILOGRAM_TO_MEGAGRAM : inertia);
    addDiagonalMass(M, base + 4, nodalMass.inertiaY !== undefined ? nodalMass.inertiaY * KILOGRAM_TO_MEGAGRAM : inertia);
    addDiagonalMass(M, base + 5, nodalMass.inertiaZ !== undefined ? nodalMass.inertiaZ * KILOGRAM_TO_MEGAGRAM : inertia);
    // `totalMass` is translational mass, not the three repeated directional
    // entries of the matrix.
    totalMass += translational;
  }
  return { M, totalMass };
};

const targetForModal = (project: Space3DProjectV1, requested?: string): string =>
  requested ?? project.loadCombinations[0]?.id ?? project.loadCases[0]?.id ?? '';

export const analyzeSpace3DModal = (
  project: Space3DProjectV1,
  options: Space3DModalOptions = {},
): Space3DModalResult => {
  const targetId = targetForModal(project, options.targetId);
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  if (!assembly.valid) return failure(targetId, 'El ensamblaje espacial no es admisible para el estudio modal.', assembly.issues);
  if (!assembly.freeDofs.length) return failure(targetId, 'Las condiciones de contorno no dejan grados de libertad libres.', [], 0, 0);

  const mass = assembleSpace3DMass(project, assembly);
  if (!(mass.totalMass > 0)) return failure(targetId, 'El modelo no declara masa distribuida ni masa nodal positiva.', [], 0, assembly.freeDofs.length);
  const freeDofs = [...assembly.freeDofs];
  const Kff = submatrix(assembly.stiffness, freeDofs, freeDofs);
  const Mff = submatrix(mass.M, freeDofs, freeDofs);
  const count = Math.max(1, Math.trunc(options.modes ?? 5));
  const eigen = generalizedSmallestEigenpairs(Kff, Mff, count, {
    positiveOnly: true,
    maxIterations: options.maxIterations,
    tolerance: options.tolerance,
  });
  if (!eigen.values.length) return failure(targetId, eigen.reason, [], mass.totalMass, assembly.freeDofs.length);

  const influence = (component: 0 | 1 | 2): number[] => {
    const vector = new Array<number>(assembly.totalDofs).fill(0);
    for (let index = component; index < vector.length; index += DOF_PER_NODE) vector[index] = 1;
    return vector;
  };
  const totalByComponent = ([0, 1, 2] as const).map((component) => {
    const vector = influence(component);
    return bilinear(mass.M, vector, vector);
  });

  const modes = eigen.values.map((omegaSquared, modeIndex): Space3DModalMode => {
    const reduced = eigen.vectors[modeIndex];
    const full = new Array<number>(assembly.totalDofs).fill(0);
    assembly.freeDofs.forEach((global, index) => { full[global] = reduced[index]; });
    const modalMass = bilinear(mass.M, full, full);
    const ratios = [0, 1, 2].map((component, index) => {
      const vector = influence(component as 0 | 1 | 2);
      return totalByComponent[index] > 0 && modalMass > 0
        ? (bilinear(mass.M, full, vector) ** 2) / modalMass / totalByComponent[index]
        : 0;
    });
    const peak = Math.max(...project.nodes.map((node) => {
      const base = project.nodes.findIndex((candidate) => candidate.id === node.id) * DOF_PER_NODE;
      return Math.max(Math.abs(full[base]), Math.abs(full[base + 1]), Math.abs(full[base + 2]));
    }), 0);
    const scale = peak > 0 ? 1 / peak : 1;
    return Object.freeze({
      angularFrequency: Math.sqrt(omegaSquared),
      frequency: Math.sqrt(omegaSquared) / (2 * Math.PI),
      period: omegaSquared > 0 ? 2 * Math.PI / Math.sqrt(omegaSquared) : Number.POSITIVE_INFINITY,
      participatingMassRatioX: ratios[0],
      participatingMassRatioY: ratios[1],
      participatingMassRatioZ: ratios[2],
      shape: Object.freeze(project.nodes.map((node, nodeIndex) => {
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
      })),
    });
  });

  return Object.freeze({
    success: true,
    targetId,
    modes: Object.freeze(modes),
    totalMass: mass.totalMass,
    converged: eigen.converged,
    residual: eigen.residual,
    freeDegreesOfFreedom: assembly.freeDofs.length,
    issues: Object.freeze([]),
    reason: eigen.reason,
  });
};

export interface Space3DPDeltaOptions extends Space3DStaticAnalysisOptions {
  readonly maxIterations?: number;
  readonly tolerance?: number;
}

export interface Space3DPDeltaResult {
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

export interface Space3DBucklingMode {
  readonly criticalLoadFactor: number;
  readonly shape: readonly (Space3DDofValues & { readonly nodeId: string })[];
}

export interface Space3DBucklingResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly modes: readonly Space3DBucklingMode[];
  readonly criticalLoadFactor?: number;
  readonly referenceAxialForces: Readonly<Record<string, number>>;
  readonly converged: boolean;
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
  residual: Number.NaN,
  freeDegreesOfFreedom,
  issues: Object.freeze([...issues]),
  reason,
});

const zeroDofValues = (): Space3DDofValues => ({ ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 });

const dofValuesFromVector = (values: readonly number[], offset: number): Space3DDofValues => ({
  ux: values[offset] ?? 0,
  uy: values[offset + 1] ?? 0,
  uz: values[offset + 2] ?? 0,
  rx: values[offset + 3] ?? 0,
  ry: values[offset + 4] ?? 0,
  rz: values[offset + 5] ?? 0,
});

const memberEndForcesFromVector = (values: readonly number[], offset: number): Space3DMemberEndForces => ({
  N: values[offset] ?? 0,
  Vy: values[offset + 1] ?? 0,
  Vz: values[offset + 2] ?? 0,
  T: values[offset + 3] ?? 0,
  My: values[offset + 4] ?? 0,
  Mz: values[offset + 5] ?? 0,
});

const crossProduct = (r: Space3DVector, f: Space3DVector): Space3DVector => [
  r[1] * f[2] - r[2] * f[1],
  r[2] * f[0] - r[0] * f[2],
  r[0] * f[1] - r[1] * f[0],
];

const equilibriumFor = (
  project: Space3DProjectV1,
  nodeResults: readonly Space3DNodeResult[],
  F: readonly number[],
): Space3DEquilibriumAudit => {
  const force: [number, number, number] = [0, 0, 0];
  const moment: [number, number, number] = [0, 0, 0];
  let forceScale = 1;
  let momentScale = 1;
  project.nodes.forEach((node, index) => {
    const base = index * DOF_PER_NODE;
    const applied: Space3DVector = [F[base] ?? 0, F[base + 1] ?? 0, F[base + 2] ?? 0];
    const appliedMoment: Space3DVector = [F[base + 3] ?? 0, F[base + 4] ?? 0, F[base + 5] ?? 0];
    const reaction = nodeResults[index]?.reaction ?? zeroDofValues();
    const reactionForce: Space3DVector = [reaction.ux, reaction.uy, reaction.uz];
    const reactionMoment: Space3DVector = [reaction.rx, reaction.ry, reaction.rz];
    const position: Space3DVector = [node.x, node.y, node.z];
    for (let axis = 0; axis < 3; axis += 1) {
      force[axis] += applied[axis] + reactionForce[axis];
      moment[axis] += appliedMoment[axis] + reactionMoment[axis] + crossProduct(position, applied)[axis] + crossProduct(position, reactionForce)[axis];
      forceScale = Math.max(forceScale, Math.abs(applied[axis]), Math.abs(reactionForce[axis]));
      momentScale = Math.max(momentScale, Math.abs(appliedMoment[axis]), Math.abs(reactionMoment[axis]), Math.abs(crossProduct(position, applied)[axis]), Math.abs(crossProduct(position, reactionForce)[axis]));
    }
  });
  return Object.freeze({
    force: Object.freeze(force) as Space3DVector,
    moment: Object.freeze(moment) as Space3DVector,
    normalized: Math.max(Math.max(...force.map(Math.abs)) / forceScale, Math.max(...moment.map(Math.abs)) / momentScale),
  });
};

const resultFromDisplacement = (
  project: Space3DProjectV1,
  assembly: ReturnType<typeof assembleSpace3DStaticModel>,
  stiffness: Matrix,
  loadVector: readonly number[],
  displacement: readonly number[],
  relativeResidual: number,
  conditionEstimate: number,
): Space3DAnalysisResult => {
  const rawReactions = multiplyMatrixVector(stiffness, displacement).map((value, index) => value - (loadVector[index] ?? 0));
  const restrained = new Set(assembly.restrainedDofs);
  const reactionVector = rawReactions.map((value, dof) => restrained.has(dof) ? value : 0);
  const nodeResults: Space3DNodeResult[] = project.nodes.map((node, index) => Object.freeze({
    nodeId: node.id,
    displacement: Object.freeze(dofValuesFromVector(displacement, index * DOF_PER_NODE)),
    reaction: Object.freeze(dofValuesFromVector(reactionVector, index * DOF_PER_NODE)),
  }));
  const memberResults: Space3DMemberResult[] = assembly.elements.map((element) => {
    const uElement = element.dofIndices.map((index) => displacement[index] ?? 0);
    const uLocal = multiplyMatrixVector(element.transformation, uElement);
    const local = multiplyMatrixVector(element.localStiffness, uLocal);
    return Object.freeze({
      memberId: element.memberId,
      length: element.length,
      basis: element.basis,
      start: Object.freeze(memberEndForcesFromVector(local, 0)),
      end: Object.freeze(memberEndForcesFromVector(local, 6)),
    });
  });
  const equilibrium = equilibriumFor(project, nodeResults, loadVector);
  return Object.freeze({
    success: true,
    targetId: assembly.targetId,
    targetKind: assembly.targetKind,
    nodeResults: Object.freeze(nodeResults),
    memberResults: Object.freeze(memberResults),
    issues: Object.freeze([]),
    diagnostics: Object.freeze({
      dofCount: assembly.totalDofs,
      freeDofCount: assembly.freeDofs.length,
      restrainedDofCount: assembly.restrainedDofs.length,
      relativeResidual,
      conditionEstimate,
      equilibrium,
    }),
  });
};

const solveWithStiffness = (
  stiffness: Matrix,
  loadVector: readonly number[],
  freeDofs: readonly number[],
): { displacement: number[]; relativeResidual: number; conditionEstimate: number } => {
  const free = [...freeDofs];
  const solved = solveLinearSystem(submatrix(stiffness, free, free), free.map((index) => loadVector[index] ?? 0));
  const displacement = new Array<number>(loadVector.length).fill(0);
  free.forEach((global, index) => { displacement[global] = solved.x[index]; });
  return { displacement, relativeResidual: solved.relativeResidual, conditionEstimate: solved.conditionEstimate };
};

const localGeometricStiffness = (length: number, compression: number): Matrix => {
  const result = zeros(12, 12);
  if (!(compression > 0) || !(length > 0)) return result;
  const coefficient = compression / (30 * length);
  const scaledBlock = (indices: readonly [number, number, number, number]) => {
    const block: readonly (readonly number[])[] = [
      [36, 3 * length, -36, 3 * length],
      [3 * length, 4 * length * length, -3 * length, -length * length],
      [-36, -3 * length, 36, -3 * length],
      [3 * length, -length * length, -3 * length, 4 * length * length],
    ];
    indices.forEach((row, i) => indices.forEach((column, j) => { result[row][column] += coefficient * block[i][j]; }));
  };
  scaledBlock([1, 5, 7, 11]);
  scaledBlock([2, 4, 8, 10]);
  return result;
};

const geometricFromDisplacement = (
  assembly: ReturnType<typeof assembleSpace3DStaticModel>,
  displacement: readonly number[],
): { matrix: Matrix; axialForces: Map<string, number> } => {
  const geometric = zeros(assembly.totalDofs, assembly.totalDofs);
  const axialForces = new Map<string, number>();
  for (const element of assembly.elements) {
    const uElement = element.dofIndices.map((index) => displacement[index] ?? 0);
    const localDisplacement = multiplyMatrixVector(element.transformation, uElement);
    const localForces = multiplyMatrixVector(element.localStiffness, localDisplacement);
    const axial = ((localForces[6] ?? 0) - (localForces[0] ?? 0)) / 2;
    axialForces.set(element.memberId, axial);
    const localGeometric = localGeometricStiffness(element.length, Math.max(0, -axial));
    const globalGeometric = multiply(transpose(element.transformation), multiply(localGeometric, element.transformation));
    element.dofIndices.forEach((row, i) => element.dofIndices.forEach((column, j) => { geometric[row][column] += globalGeometric[i][j]; }));
  }
  return { matrix: geometric, axialForces };
};

export const analyzeSpace3DPDelta = (
  project: Space3DProjectV1,
  targetId: string,
  options: Space3DPDeltaOptions = {},
): Space3DPDeltaResult => {
  const linear = ((): Space3DAnalysisResult => {
    const assembly = assembleSpace3DStaticModel(project, targetId, options);
    return assembly.valid ? analyzeSpace3DStatic(project, targetId, options) : Object.freeze({
      success: false, targetId, targetKind: assembly.targetKind, nodeResults: Object.freeze([]), memberResults: Object.freeze([]), issues: assembly.issues,
      diagnostics: Object.freeze({ dofCount: assembly.totalDofs, freeDofCount: 0, restrainedDofCount: 0, relativeResidual: Number.NaN, conditionEstimate: Number.NaN, equilibrium: Object.freeze({ force: Object.freeze([0, 0, 0]) as Space3DVector, moment: Object.freeze([0, 0, 0]) as Space3DVector, normalized: Number.NaN }) }),
    });
  })();
  if (!linear.success) return pDeltaFailure(targetId, 'El análisis lineal de referencia no es válido.', linear, linear.issues);
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  const maxIterations = Math.max(1, Math.trunc(options.maxIterations ?? 20));
  const tolerance = options.tolerance ?? 1e-7;
  let displacement = project.nodes.flatMap((_, index) => {
    const result = linear.nodeResults[index];
    return result ? [result.displacement.ux, result.displacement.uy, result.displacement.uz, result.displacement.rx, result.displacement.ry, result.displacement.rz] : [0, 0, 0, 0, 0, 0];
  });
  let stiffness = assembly.stiffness;
  let solved = { relativeResidual: linear.diagnostics.relativeResidual, conditionEstimate: linear.diagnostics.conditionEstimate };
  let converged = false;
  let iterations = 0;
  for (iterations = 1; iterations <= maxIterations; iterations += 1) {
    const geometric = geometricFromDisplacement(assembly, displacement).matrix;
    stiffness = assembly.stiffness.map((row, i) => row.map((value, j) => value - geometric[i][j]));
    try {
      const next = solveWithStiffness(stiffness, assembly.loadVector, assembly.freeDofs);
      const difference = Math.hypot(...next.displacement.map((value, index) => value - displacement[index]));
      const scale = Math.max(1, Math.hypot(...next.displacement));
      displacement = next.displacement;
      solved = { relativeResidual: next.relativeResidual, conditionEstimate: next.conditionEstimate };
      if (difference <= tolerance * scale) { converged = true; break; }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'sistema singular';
      return pDeltaFailure(targetId, `El P-Delta no pudo resolver la rigidez geométrica: ${message}`, linear);
    }
  }
  const analysis = resultFromDisplacement(project, assembly, stiffness, assembly.loadVector, displacement, solved.relativeResidual, solved.conditionEstimate);
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
  const reference = analyzeSpace3DStatic(project, targetId, options);
  if (!reference.success) return bucklingFailure(targetId, 'El análisis lineal de referencia no es válido para pandeo.', reference.issues);
  const displacement = project.nodes.flatMap((_, index) => {
    const node = reference.nodeResults[index];
    return node ? [node.displacement.ux, node.displacement.uy, node.displacement.uz, node.displacement.rx, node.displacement.ry, node.displacement.rz] : [0, 0, 0, 0, 0, 0];
  });
  const geometric = geometricFromDisplacement(assembly, displacement);
  const referenceAxialForces = Object.fromEntries(geometric.axialForces);
  if (![...geometric.axialForces.values()].some((value) => value < 0)) return bucklingFailure(targetId, 'Ningún miembro está comprimido bajo esta combinación.', [], referenceAxialForces, assembly.freeDofs.length);
  const freeDofs = [...assembly.freeDofs];
  const eigen = generalizedSmallestEigenpairs(submatrix(assembly.stiffness, freeDofs, freeDofs), submatrix(geometric.matrix, freeDofs, freeDofs), Math.max(1, Math.trunc(options.modes ?? 3)), { positiveOnly: true, maxIterations: options.maxIterations, tolerance: options.tolerance });
  if (!eigen.values.length) return bucklingFailure(targetId, eigen.reason, [], referenceAxialForces, freeDofs.length);
  const modes = eigen.values.map((criticalLoadFactor, index) => {
    const full = new Array<number>(assembly.totalDofs).fill(0);
    freeDofs.forEach((global, reduced) => { full[global] = eigen.vectors[index][reduced]; });
    const peak = Math.max(...project.nodes.map((_, nodeIndex) => Math.max(Math.abs(full[nodeIndex * DOF_PER_NODE]), Math.abs(full[nodeIndex * DOF_PER_NODE + 1]), Math.abs(full[nodeIndex * DOF_PER_NODE + 2]))), 0);
    const scale = peak > 0 ? 1 / peak : 1;
    return Object.freeze({
      criticalLoadFactor,
      shape: Object.freeze(project.nodes.map((node, nodeIndex) => Object.freeze({
        nodeId: node.id,
        ux: full[nodeIndex * DOF_PER_NODE] * scale,
        uy: full[nodeIndex * DOF_PER_NODE + 1] * scale,
        uz: full[nodeIndex * DOF_PER_NODE + 2] * scale,
        rx: full[nodeIndex * DOF_PER_NODE + 3] * scale,
        ry: full[nodeIndex * DOF_PER_NODE + 4] * scale,
        rz: full[nodeIndex * DOF_PER_NODE + 5] * scale,
      }))),
    });
  });
  return Object.freeze({
    success: true,
    targetId,
    modes: Object.freeze(modes),
    criticalLoadFactor: modes[0].criticalLoadFactor,
    referenceAxialForces,
    converged: eigen.converged,
    residual: eigen.residual,
    freeDegreesOfFreedom: freeDofs.length,
    issues: Object.freeze([]),
    reason: eigen.reason,
  });
};
