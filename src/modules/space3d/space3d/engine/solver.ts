/**
 * Solver estático lineal para marcos espaciales.
 *
 * Flujo fail-closed: validar → resolver el objetivo de carga → ensamblar →
 * reducir por restricciones homogéneas → resolver → recuperar reacciones,
 * acciones de extremo y auditoría de equilibrio 6D. Cualquier problema devuelve
 * un resultado sin `nodeResults` ni `memberResults`: nunca se publica una
 * respuesta parcialmente utilizable.
 *
 * `solveLinearSystem` se consume como primitiva numérica neutral de sólo lectura.
 */
import {
  LinearAlgebraError,
  multiplyMatrixVector,
  solveLinearSystem,
  submatrix,
  subvector,
  type Matrix,
  zeros,
} from '../../foundation/linearAlgebra';
import { buildSpaceFrameElement } from './element';
import type { Space3DElement } from './element';
import { validateSpace3DProject } from '../model/validation';
import {
  SPACE3D_DOF_KEYS,
  Space3DGeometryError,
  type Space3DAnalysisDiagnostics,
  type Space3DAnalysisIssue,
  type Space3DAnalysisResult,
  type Space3DDofValues,
  type Space3DEquilibriumAudit,
  type Space3DFrameMember,
  type Space3DMemberEndForces,
  type Space3DMemberResult,
  type Space3DNodeResult,
  type Space3DProjectV1,
  type Space3DVector,
} from '../model/types';

const DOF_PER_NODE = 6;

const EMPTY_EQUILIBRIUM: Space3DEquilibriumAudit = Object.freeze({
  force: Object.freeze([0, 0, 0] as const),
  moment: Object.freeze([0, 0, 0] as const),
  normalized: 0,
});

const emptyDiagnostics = (): Space3DAnalysisDiagnostics => Object.freeze({
  dofCount: 0,
  freeDofCount: 0,
  restrainedDofCount: 0,
  relativeResidual: 0,
  conditionEstimate: 0,
  equilibrium: EMPTY_EQUILIBRIUM,
});

const failed = (
  targetId: string,
  targetKind: Space3DAnalysisResult['targetKind'],
  issues: readonly Space3DAnalysisIssue[],
  diagnostics: Space3DAnalysisDiagnostics = emptyDiagnostics(),
): Space3DAnalysisResult => Object.freeze({
  success: false,
  targetId,
  targetKind,
  nodeResults: Object.freeze([]),
  memberResults: Object.freeze([]),
  issues: Object.freeze([...issues]),
  diagnostics,
});

const issue = (
  code: Space3DAnalysisIssue['code'],
  entityKind: Space3DAnalysisIssue['entityKind'],
  entityId: string,
  field = '',
): Space3DAnalysisIssue => ({ code, entityKind, entityId, field });

const dofValues = (values: readonly number[], offset: number): Space3DDofValues => Object.freeze({
  ux: values[offset],
  uy: values[offset + 1],
  uz: values[offset + 2],
  rx: values[offset + 3],
  ry: values[offset + 4],
  rz: values[offset + 5],
});

const endForces = (values: readonly number[], offset: number): Space3DMemberEndForces => Object.freeze({
  N: values[offset],
  Vy: values[offset + 1],
  Vz: values[offset + 2],
  T: values[offset + 3],
  My: values[offset + 4],
  Mz: values[offset + 5],
});

const crossProduct = (r: Space3DVector, f: Space3DVector): Space3DVector => [
  r[1] * f[2] - r[2] * f[1],
  r[2] * f[0] - r[0] * f[2],
  r[0] * f[1] - r[1] * f[0],
];

/**
 * Reparte el objetivo de análisis en factores por caso. Un caso vale 1×; una
 * combinación acumula los factores declarados, sumando los repetidos.
 */
export const resolveSpace3DTarget = (project: Space3DProjectV1, targetId: string) => {
  if (project.loadCases.some((item) => item.id === targetId)) {
    return { kind: 'case' as const, factors: new Map([[targetId, 1]]) };
  }
  const combination = project.loadCombinations.find((item) => item.id === targetId);
  if (!combination) return null;
  const factors = new Map<string, number>();
  for (const term of combination.terms) {
    factors.set(term.caseId, (factors.get(term.caseId) ?? 0) + term.factor);
  }
  return { kind: 'combination' as const, factors };
};

/** Traduce un fallo numérico del solve en un issue estable, o lo relanza si es un bug. */
const classifySolveFailure = (error: unknown): Space3DAnalysisIssue => {
  if (error instanceof LinearAlgebraError) {
    if (error.code === 'singular') return issue('mechanism', 'project', '');
    if (error.code === 'non-finite-value') return issue('non-finite-solution', 'project', '');
    throw error;
  }
  if (!(error instanceof Error)) throw error;
  if (/singular|mecanismo/i.test(error.message)) return issue('mechanism', 'project', '');
  if (/no finitos/i.test(error.message)) return issue('non-finite-solution', 'project', '');
  throw error;
};

/**
 * Adaptador heredado del solver de marcos. Se mantiene como referencia
 * diferencial mientras el ensamblador canónico migra semánticas adicionales.
 */
const analyzeSpace3DProjectLegacy = (project: Space3DProjectV1, targetId: string): Space3DAnalysisResult => {
  const validationIssues = validateSpace3DProject(project);
  if (validationIssues.length > 0) {
    return failed(targetId, 'unknown', validationIssues.map((item) => issue(item.code, item.entityKind, item.entityId, item.field)));
  }

  const target = resolveSpace3DTarget(project, targetId);
  if (!target) return failed(targetId, 'unknown', [issue('unknown-target', 'project', targetId)]);

  // V2 deliberately keeps truss and rigid members lossless, but this legacy
  // engine only assembles frame stiffness. Reject them before assembly rather
  // than silently treating a different physical model as a frame (Task 7).
  const unsupportedMembers = project.members.filter((member) => member.type === 'truss' || member.type === 'rigid');
  if (unsupportedMembers.length > 0) {
    return failed(targetId, target.kind, unsupportedMembers.map((member) => issue('unsupported-member-type', 'member', member.id, 'type')));
  }

  if (project.nodes.length === 0 || project.members.length === 0) {
    return failed(targetId, target.kind, [issue('empty-model', 'project', '')]);
  }

  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  const totalDofs = project.nodes.length * DOF_PER_NODE;

  const K = zeros(totalDofs, totalDofs);
  const elements = [];
  try {
    for (const member of project.members) {
      const i = nodeIndex.get(member.i)!;
      const j = nodeIndex.get(member.j)!;
      const element = buildSpaceFrameElement(member, project.nodes[i], project.nodes[j]);
      elements.push({ element, i, j });
      const map = [
        i * DOF_PER_NODE, i * DOF_PER_NODE + 1, i * DOF_PER_NODE + 2, i * DOF_PER_NODE + 3, i * DOF_PER_NODE + 4, i * DOF_PER_NODE + 5,
        j * DOF_PER_NODE, j * DOF_PER_NODE + 1, j * DOF_PER_NODE + 2, j * DOF_PER_NODE + 3, j * DOF_PER_NODE + 4, j * DOF_PER_NODE + 5,
      ];
      for (let row = 0; row < 12; row += 1) {
        for (let col = 0; col < 12; col += 1) K[map[row]][map[col]] += element.globalStiffness[row][col];
      }
    }
  } catch (error) {
    if (!(error instanceof Space3DGeometryError)) throw error;
    return failed(targetId, target.kind, [issue('degenerate-orientation', 'member', '', error.code)]);
  }

  const F = new Array<number>(totalDofs).fill(0);
  for (const load of project.nodalLoads) {
    const factor = target.factors.get(load.caseId);
    if (factor === undefined || factor === 0) continue;
    const base = nodeIndex.get(load.nodeId)! * DOF_PER_NODE;
    F[base] += load.fx * factor;
    F[base + 1] += load.fy * factor;
    F[base + 2] += load.fz * factor;
    F[base + 3] += load.mx * factor;
    F[base + 4] += load.my * factor;
    F[base + 5] += load.mz * factor;
  }

  const restrained = new Set<number>();
  project.nodes.forEach((node, index) => {
    SPACE3D_DOF_KEYS.forEach((key, dof) => {
      if (node.restraints[key]) restrained.add(index * DOF_PER_NODE + dof);
    });
  });

  const free: number[] = [];
  for (let index = 0; index < totalDofs; index += 1) if (!restrained.has(index)) free.push(index);
  if (free.length === 0) return failed(targetId, target.kind, [issue('no-free-dof', 'project', '')]);

  const Kff = submatrix(K, free, free);
  const Ff = subvector(F, free);

  let solved;
  try {
    solved = solveLinearSystem(Kff, Ff);
  } catch (error) {
    return failed(targetId, target.kind, [classifySolveFailure(error)]);
  }
  if (solved.x.some((value) => !Number.isFinite(value)) || !Number.isFinite(solved.relativeResidual)) {
    return failed(targetId, target.kind, [issue('mechanism', 'project', '')]);
  }

  const U = new Array<number>(totalDofs).fill(0);
  free.forEach((global, index) => { U[global] = solved.x[index]; });

  const rawReactions = multiplyMatrixVector(K, U).map((value, index) => value - F[index]);
  const R = rawReactions.map((value, index) => (restrained.has(index) ? value : 0));

  const nodeResults: Space3DNodeResult[] = project.nodes.map((node, index) => Object.freeze({
    nodeId: node.id,
    displacement: dofValues(U, index * DOF_PER_NODE),
    reaction: dofValues(R, index * DOF_PER_NODE),
  }));

  const memberResults: Space3DMemberResult[] = elements.map(({ element, i, j }) => {
    const uElement = [
      ...U.slice(i * DOF_PER_NODE, i * DOF_PER_NODE + 6),
      ...U.slice(j * DOF_PER_NODE, j * DOF_PER_NODE + 6),
    ];
    const uLocal = multiplyMatrixVector(element.transformation, uElement);
    const fLocal = multiplyMatrixVector(element.localStiffness, uLocal);
    return Object.freeze({
      memberId: element.memberId,
      length: element.length,
      basis: element.basis,
      start: endForces(fLocal, 0),
      end: endForces(fLocal, 6),
    });
  });

  const equilibrium = auditEquilibrium(project, nodeResults, F, nodeIndex);

  const diagnostics: Space3DAnalysisDiagnostics = Object.freeze({
    dofCount: totalDofs,
    freeDofCount: free.length,
    restrainedDofCount: restrained.size,
    relativeResidual: solved.relativeResidual,
    conditionEstimate: solved.conditionEstimate,
    equilibrium,
  });

  return Object.freeze({
    success: true,
    targetId,
    targetKind: target.kind,
    nodeResults: Object.freeze(nodeResults),
    memberResults: Object.freeze(memberResults),
    issues: Object.freeze([]),
    diagnostics,
  });
};

/**
 * Auditoría global 6D: fuerzas aplicadas más reacciones deben anularse, y lo
 * mismo los momentos respecto al origen incluyendo `r × F`. El residual se
 * normaliza por separado en fuerza y momento porque comparten magnitud pero no
 * unidad, y se toma el peor de los dos.
 */
const auditEquilibrium = (
  project: Space3DProjectV1,
  nodeResults: readonly Space3DNodeResult[],
  F: readonly number[],
  nodeIndex: ReadonlyMap<string, number>,
): Space3DEquilibriumAudit => {
  const force: [number, number, number] = [0, 0, 0];
  const moment: [number, number, number] = [0, 0, 0];
  let forceScale = 1;
  let momentScale = 1;

  const accumulate = (position: Space3DVector, f: Space3DVector, m: Space3DVector) => {
    const torque = crossProduct(position, f);
    for (let axis = 0; axis < 3; axis += 1) {
      force[axis] += f[axis];
      moment[axis] += m[axis] + torque[axis];
      forceScale = Math.max(forceScale, Math.abs(f[axis]));
      momentScale = Math.max(momentScale, Math.abs(m[axis]), Math.abs(torque[axis]));
    }
  };

  project.nodes.forEach((node, index) => {
    const position: Space3DVector = [node.x, node.y, node.z];
    const base = index * 6;
    accumulate(position, [F[base], F[base + 1], F[base + 2]], [F[base + 3], F[base + 4], F[base + 5]]);
    const reaction = nodeResults[nodeIndex.get(node.id)!].reaction;
    accumulate(position, [reaction.ux, reaction.uy, reaction.uz], [reaction.rx, reaction.ry, reaction.rz]);
  });

  const normalized = Math.max(
    Math.max(...force.map(Math.abs)) / forceScale,
    Math.max(...moment.map(Math.abs)) / momentScale,
  );

  return Object.freeze({
    force: Object.freeze([force[0], force[1], force[2]] as const),
    moment: Object.freeze([moment[0], moment[1], moment[2]] as const),
    normalized,
  });
};

/** Resultado neutro para superficies que aún no han analizado. */
export const emptySpace3DAnalysisResult = (targetId: string): Space3DAnalysisResult =>
  failed(targetId, 'unknown', []);

/** Opciones del ensamblador estático canónico de seis GDL. */
export interface Space3DStaticAnalysisOptions {
  readonly backend?: 'auto' | 'dense' | 'sparse';
  readonly includeAssemblyTrace?: boolean;
}

export interface Space3DStaticAssemblyElement {
  readonly memberId: string;
  readonly nodeI: string;
  readonly nodeJ: string;
  readonly dofIndices: readonly number[];
  readonly length: number;
  readonly basis: Space3DElement['basis'];
  readonly localStiffness: Matrix;
  readonly transformation: Matrix;
  readonly globalStiffness: Matrix;
}

/**
 * Representación única del problema estático espacial. `K`/`F` son alias
 * intencionados de `stiffness`/`loadVector` para que las herramientas de
 * diagnóstico puedan usar la notación habitual sin copiar matrices.
 *
 * La asamblea no impone un máximo de entidades: el runtime que la invoque es
 * quien debe admitirla según su presupuesto de memoria.
 */
export interface Space3DStaticAssembly {
  readonly valid: boolean;
  readonly targetId: string;
  readonly targetKind: Space3DAnalysisResult['targetKind'];
  readonly totalDofs: number;
  readonly stiffness: Matrix;
  readonly loadVector: readonly number[];
  readonly K: Matrix;
  readonly F: readonly number[];
  readonly nodeDofIndices: ReadonlyMap<string, readonly number[]>;
  readonly restrainedDofs: readonly number[];
  readonly freeDofs: readonly number[];
  readonly elements: readonly Space3DStaticAssemblyElement[];
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly backend: 'dense-reference' | 'sparse-requested';
  readonly assemblyTrace?: readonly {
    readonly memberId: string;
    readonly dofIndices: readonly number[];
    readonly maxStiffnessCoefficient: number;
  }[];
}

const unsupportedSemantic = (
  entityKind: Space3DAnalysisIssue['entityKind'],
  entityId: string,
  field: string,
): Space3DAnalysisIssue => issue('unsupported-semantics', entityKind, entityId, field);

const hasMeaningfulMemberSemantics = (member: Space3DFrameMember): readonly string[] => {
  const fields: string[] = [];
  if (member.type === 'truss' || member.type === 'rigid') fields.push('type');
  if (member.releases) fields.push('releases');
  if (member.beamTheory && member.beamTheory !== 'euler-bernoulli') fields.push('beamTheory');
  if (member.shearArea !== undefined) fields.push('shearArea');
  if (member.axialBehavior && member.axialBehavior !== 'both') fields.push('axialBehavior');
  if (member.rotationalSpringI !== undefined) fields.push('rotationalSpringI');
  if (member.rotationalSpringJ !== undefined) fields.push('rotationalSpringJ');
  if (member.rigidOffsetI !== undefined && member.rigidOffsetI !== 0) fields.push('rigidOffsetI');
  if (member.rigidOffsetJ !== undefined && member.rigidOffsetJ !== 0) fields.push('rigidOffsetJ');
  return fields;
};

const collectUnsupportedStaticSemantics = (
  project: Space3DProjectV1,
): Space3DAnalysisIssue[] => {
  const issues: Space3DAnalysisIssue[] = [];
  for (const member of project.members) {
    for (const field of hasMeaningfulMemberSemantics(member)) {
      // `type` has its own stable diagnostic used by the compatibility corpus.
      if (field !== 'type') issues.push(unsupportedSemantic('member', member.id, field));
    }
  }
  for (const node of project.nodes) {
    if (node.internalHinge) issues.push(unsupportedSemantic('node', node.id, 'internalHinge'));
    if (node.planarSupport && node.planarSupport.type !== 'none') {
      issues.push(unsupportedSemantic('node', node.id, 'planarSupport'));
    }
  }
  const nonEmptyCollections: readonly [Space3DAnalysisIssue['entityKind'], readonly { readonly id: string }[], string][] = [
    ['member-load', project.memberLoads, 'memberLoads'],
    ['initial-effect', project.memberInitialEffects, 'memberInitialEffects'],
    ['node-link', project.nodeLinks, 'nodeLinks'],
    ['multi-point-constraint', project.multiPointConstraints, 'multiPointConstraints'],
    ['prescribed-displacement', project.prescribedDisplacements, 'prescribedDisplacements'],
    ['generated-load-source', project.generatedLoadSources, 'generatedLoadSources'],
    ['moving-load-case', project.movingLoadCases, 'movingLoadCases'],
  ];
  for (const [entityKind, entities, field] of nonEmptyCollections) {
    for (const entity of entities) issues.push(unsupportedSemantic(entityKind, entity.id, field));
  }
  // Nodal masses are inert data for a static run, so they are intentionally
  // allowed here; modal analysis will consume the same document in Task 7B.
  return issues;
};

const emptyStaticAssembly = (
  targetId: string,
  targetKind: Space3DAnalysisResult['targetKind'],
  issues: readonly Space3DAnalysisIssue[],
  backend: Space3DStaticAssembly['backend'],
  totalDofs = 0,
  nodeDofIndices: ReadonlyMap<string, readonly number[]> = new Map(),
): Space3DStaticAssembly => {
  const stiffness = zeros(totalDofs, totalDofs);
  const loadVector = new Array<number>(totalDofs).fill(0);
  return Object.freeze({
    valid: false,
    targetId,
    targetKind,
    totalDofs,
    stiffness,
    loadVector,
    K: stiffness,
    F: loadVector,
    nodeDofIndices,
    restrainedDofs: Object.freeze([]),
    freeDofs: Object.freeze([]),
    elements: Object.freeze([]),
    issues: Object.freeze([...issues]),
    backend,
  });
};

/**
 * Ensambla el problema lineal estático espacial una sola vez. La salida es
 * deliberadamente explícita para que workers, auditorías y futuros modos
 * (P-Delta/modal/pandeo/influencia) consuman exactamente la misma base.
 */
export const assembleSpace3DStaticModel = (
  project: Space3DProjectV1,
  targetId: string,
  options: Space3DStaticAnalysisOptions = {},
): Space3DStaticAssembly => {
  const backend: Space3DStaticAssembly['backend'] = options.backend === 'sparse' ? 'sparse-requested' : 'dense-reference';
  const validationIssues = validateSpace3DProject(project);
  // Do not dereference malformed collections after validation has failed; the
  // public analyzer must classify bad input instead of leaking a native
  // `undefined.some`/getter exception from target resolution.
  const target = validationIssues.length === 0 ? resolveSpace3DTarget(project, targetId) : null;
  const targetKind = target?.kind ?? 'unknown';
  const totalDofs = Array.isArray(project?.nodes) ? project.nodes.length * DOF_PER_NODE : 0;
  const nodeDofIndices = new Map<string, readonly number[]>();
  if (validationIssues.length > 0) {
    return emptyStaticAssembly(targetId, targetKind, validationIssues.map((item) => issue(item.code, item.entityKind, item.entityId, item.field)), backend, totalDofs, nodeDofIndices);
  }
  if (!target) return emptyStaticAssembly(targetId, targetKind, [issue('unknown-target', 'project', targetId)], backend, totalDofs, nodeDofIndices);
  if (project.nodes.length === 0 || project.members.length === 0) {
    return emptyStaticAssembly(targetId, target.kind, [issue('empty-model', 'project', '')], backend, totalDofs, nodeDofIndices);
  }

  const unsupportedMembers = project.members.filter((member) => member.type === 'truss' || member.type === 'rigid');
  const semantics = collectUnsupportedStaticSemantics(project);
  if (unsupportedMembers.length > 0 || semantics.length > 0) {
    const memberIssues = unsupportedMembers.map((member) => issue('unsupported-member-type', 'member', member.id, 'type'));
    return emptyStaticAssembly(targetId, target.kind, [...memberIssues, ...semantics], backend, totalDofs, nodeDofIndices);
  }

  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  project.nodes.forEach((node, index) => {
    nodeDofIndices.set(node.id, Object.freeze(Array.from({ length: DOF_PER_NODE }, (_, dof) => index * DOF_PER_NODE + dof)));
  });
  const stiffness = zeros(totalDofs, totalDofs);
  const elements: Space3DStaticAssemblyElement[] = [];
  const elementTrace: { memberId: string; dofIndices: readonly number[]; maxStiffnessCoefficient: number }[] = [];
  try {
    for (const member of project.members) {
      const i = nodeIndex.get(member.i);
      const j = nodeIndex.get(member.j);
      if (i === undefined || j === undefined) continue;
      const element = buildSpaceFrameElement(member, project.nodes[i], project.nodes[j]);
      const dofIndices = Object.freeze([
        ...Array.from({ length: DOF_PER_NODE }, (_, dof) => i * DOF_PER_NODE + dof),
        ...Array.from({ length: DOF_PER_NODE }, (_, dof) => j * DOF_PER_NODE + dof),
      ]);
      for (let row = 0; row < dofIndices.length; row += 1) {
        for (let col = 0; col < dofIndices.length; col += 1) stiffness[dofIndices[row]][dofIndices[col]] += element.globalStiffness[row][col];
      }
      const assembled = Object.freeze({
        memberId: member.id,
        nodeI: member.i,
        nodeJ: member.j,
        dofIndices,
        length: element.length,
        basis: element.basis,
        localStiffness: element.localStiffness,
        transformation: element.transformation,
        globalStiffness: element.globalStiffness,
      });
      elements.push(assembled);
      if (options.includeAssemblyTrace) elementTrace.push({ memberId: member.id, dofIndices, maxStiffnessCoefficient: Math.max(...element.globalStiffness.flat().map(Math.abs)) });
    }
  } catch (error) {
    if (error instanceof Space3DGeometryError) {
      return emptyStaticAssembly(targetId, target.kind, [issue('degenerate-orientation', 'member', '', error.code)], backend, totalDofs, nodeDofIndices);
    }
    throw error;
  }

  const loadVector = new Array<number>(totalDofs).fill(0);
  for (const load of project.nodalLoads) {
    const factor = target.factors.get(load.caseId);
    const index = nodeIndex.get(load.nodeId);
    if (factor === undefined || factor === 0 || index === undefined) continue;
    const base = index * DOF_PER_NODE;
    loadVector[base] += load.fx * factor;
    loadVector[base + 1] += load.fy * factor;
    loadVector[base + 2] += load.fz * factor;
    loadVector[base + 3] += load.mx * factor;
    loadVector[base + 4] += load.my * factor;
    loadVector[base + 5] += load.mz * factor;
  }

  const restrainedDofs: number[] = [];
  project.nodes.forEach((node, index) => {
    SPACE3D_DOF_KEYS.forEach((key, dof) => { if (node.restraints[key]) restrainedDofs.push(index * DOF_PER_NODE + dof); });
  });
  const restrainedSet = new Set(restrainedDofs);
  const freeDofs: number[] = [];
  for (let dof = 0; dof < totalDofs; dof += 1) if (!restrainedSet.has(dof)) freeDofs.push(dof);
  const assemblyTrace = options.includeAssemblyTrace ? Object.freeze(elementTrace) : undefined;
  return Object.freeze({
    valid: true,
    targetId,
    targetKind: target.kind,
    totalDofs,
    stiffness,
    loadVector,
    K: stiffness,
    F: loadVector,
    nodeDofIndices,
    restrainedDofs: Object.freeze(restrainedDofs),
    freeDofs: Object.freeze(freeDofs),
    elements: Object.freeze(elements),
    issues: Object.freeze([]),
    backend,
    ...(assemblyTrace ? { assemblyTrace } : {}),
  });
};

/**
 * Punto de entrada estático nuevo. El solver heredado sigue siendo la
 * referencia numérica para esta primera fase, pero sólo se ejecuta después de
 * que la asamblea canónica haya admitido el documento sin omitir semánticas.
 */
export const analyzeSpace3DStatic = (
  project: Space3DProjectV1,
  targetId: string,
  options: Space3DStaticAnalysisOptions = {},
): Space3DAnalysisResult => {
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  if (!assembly.valid) return failed(targetId, assembly.targetKind, assembly.issues);
  if (assembly.freeDofs.length === 0) return failed(targetId, assembly.targetKind, [issue('no-free-dof', 'project', '')]);
  return analyzeSpace3DProjectLegacy(project, targetId);
};

/** Compatibilidad pública: el adaptador heredado ahora pasa por la admisión canónica. */
export const analyzeSpace3DProject = analyzeSpace3DStatic;
