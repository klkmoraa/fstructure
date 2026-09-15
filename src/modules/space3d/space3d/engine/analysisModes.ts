/** Estudios modales espaciales sobre el ensamblaje canónico de seis GDL. */
import {
  generalizedSmallestEigenpairs,
} from '../../../../engine/eigen';
import {
  multiplyMatrixVector,
  submatrix,
  zeros,
  type Matrix,
} from '../../foundation/linearAlgebra';
import {
  assembleSpace3DStaticModel,
  type Space3DStaticAnalysisOptions,
} from './solver';
import type {
  Space3DAnalysisIssue,
  Space3DDofValues,
  Space3DProjectV1,
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
