/**
 * Solver estático lineal para marcos espaciales.
 *
 * Flujo fail-closed: validar → resolver el objetivo de carga → ensamblar →
 * reducir por restricciones → resolver → recuperar reacciones, acciones de
 * extremo, estaciones a lo largo de cada barra y auditoría de equilibrio 6D.
 * Cualquier problema devuelve un resultado sin `nodeResults` ni
 * `memberResults`: nunca se publica una respuesta parcialmente utilizable.
 *
 * Lo que el motor resuelve, al modo de SAP2000/ETABS:
 *
 *   · barras frame (6 GDL por extremo) y armaduras (sólo axil);
 *   · liberaciones de extremo por condensación estática;
 *   · cargas en nudos, cargas en barra —distribuidas trapezoidales parciales,
 *     puntuales y pares, en ejes globales o locales y por longitud real u
 *     horizontal/vertical proyectada— y peso propio por caso;
 *   · GDL sin rigidez y sin carga (giros de nudos que sólo reciben armaduras
 *     o barras articuladas, nudos sueltos) se fijan solos y se informan.
 *
 * `solveLinearSystem` se consume como primitiva numérica neutral de sólo lectura.
 */
import {
  multiplyMatrixVector,
  type Matrix,
  zeros,
} from '../../../../foundation/linearAlgebra';
import {
  assessAnalysisAdmission,
  createBrowserAnalysisBudget,
  estimateSparseLinearSystemBytes,
} from '../../../../numeric/admission';
import type { AnalysisBudget } from '../../../../shared/contracts';
import {
  buildSpaceFrameElement,
  condenseFixedEndForces,
  recoverMemberEndDisplacements,
  Space3DReleaseInstabilityError,
  type Space3DElement,
} from './element';
import {
  computeSpace3DMemberStations,
  EMPTY_LOCAL_LOADS,
  hasSpace3DLocalLoads,
  resolveSpace3DMemberLoads,
  space3DFixedEndForces,
  space3DSelfWeightFactor,
  type Space3DLocalLoadSet,
} from './memberLoading';
import {
  addToSkyline,
  createSkylineMatrix,
  factorizeSkyline,
  reverseCuthillMcKeeOrder,
  skylineInfinityNorm,
  Space3DSingularMatrixError,
  type Space3DSkylineFactorization,
} from './skylineSolver';
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
  type Space3DMemberLoad,
  type Space3DMemberResult,
  type Space3DNodeResult,
  type Space3DProjectV1,
  type Space3DVector,
} from '../model/types';

const DOF_PER_NODE = 6;
const ZERO_END_FORCES: readonly number[] = Object.freeze(new Array<number>(12).fill(0));

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
  ux: values[offset] ?? 0,
  uy: values[offset + 1] ?? 0,
  uz: values[offset + 2] ?? 0,
  rx: values[offset + 3] ?? 0,
  ry: values[offset + 4] ?? 0,
  rz: values[offset + 5] ?? 0,
});

const endForces = (values: readonly number[], offset: number): Space3DMemberEndForces => Object.freeze({
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

/**
 * Auditoría global 6D: fuerzas aplicadas más reacciones deben anularse, y lo
 * mismo los momentos respecto al origen incluyendo `r × F`. Las cargas en
 * barra entran por su vector nodal equivalente, que tiene su misma resultante
 * y su mismo momento. El residual se normaliza por separado en fuerza y
 * momento y se toma el peor de los dos.
 */
const auditEquilibrium = (
  project: Space3DProjectV1,
  nodeResults: readonly Space3DNodeResult[],
  F: readonly number[],
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
    const base = index * DOF_PER_NODE;
    accumulate(position, [F[base], F[base + 1], F[base + 2]], [F[base + 3], F[base + 4], F[base + 5]]);
    const reaction = nodeResults[index].reaction;
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

/** Opciones del ensamblador estático canónico de seis GDL. */
export interface Space3DStaticAnalysisOptions {
  readonly backend?: 'auto' | 'dense' | 'sparse';
  readonly includeAssemblyTrace?: boolean;
  readonly budget?: AnalysisBudget;
  /** Tramos uniformes de las estaciones de cada barra (12 por omisión). */
  readonly stationSegments?: number;
  /**
   * El consumidor necesita la rigidez densa (modal, pandeo, P-Delta): se
   * admite contra el presupuesto de la matriz completa antes de ensamblar.
   */
  readonly requireDense?: boolean;
}

interface Space3DStaticAssemblyElement {
  readonly memberId: string;
  readonly nodeI: string;
  readonly nodeJ: string;
  readonly kind: Space3DElement['kind'];
  readonly dofIndices: readonly number[];
  readonly length: number;
  readonly basis: Space3DElement['basis'];
  /** Rigidez local condensada. */
  readonly localStiffness: Matrix;
  readonly transformation: Matrix;
  readonly globalStiffness: Matrix;
  /** El elemento completo, para condensar y recuperar liberaciones. */
  readonly element: Space3DElement;
  /** Cargas del objetivo sobre la barra, en ejes locales. */
  readonly loads: Space3DLocalLoadSet;
  /** Empotramiento perfecto sin condensar, local (12). */
  readonly rawFixedEndForces: readonly number[];
  /** Empotramiento perfecto condensado, local (12). */
  readonly fixedEndForces: readonly number[];
  readonly E: number;
  readonly Iy: number;
  readonly Iz: number;
}

/**
 * Representación única del problema estático espacial. `K`/`F` son alias
 * intencionados de `stiffness`/`loadVector` para que las herramientas de
 * diagnóstico puedan usar la notación habitual sin copiar matrices.
 *
 * La asamblea no impone un máximo de entidades: el runtime que la invoque es
 * quien debe admitirla según su presupuesto de memoria.
 */
interface Space3DStaticAssembly {
  readonly valid: boolean;
  readonly targetId: string;
  readonly targetKind: Space3DAnalysisResult['targetKind'];
  readonly totalDofs: number;
  readonly stiffness: Matrix;
  readonly loadVector: readonly number[];
  readonly K: Matrix;
  readonly F: readonly number[];
  readonly nodeDofIndices: ReadonlyMap<string, readonly number[]>;
  /** Restringidos por la persona más los fijados automáticamente. */
  readonly restrainedDofs: readonly number[];
  /** GDL sin rigidez ni carga que el ensamblaje fijó solo. */
  readonly autoRestrainedDofs: readonly number[];
  readonly freeDofs: readonly number[];
  readonly elements: readonly Space3DStaticAssemblyElement[];
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly backend: 'dense-reference' | 'sparse-requested';
  /**
   * Numeración del perfil: `position[dof]` es la fila del GDL libre en la
   * matriz reordenada (−1 si está restringido) y `firstColumn` la primera
   * columna no nula de cada fila.
   */
  readonly profile: { readonly position: Int32Array; readonly firstColumn: Int32Array };
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

/** Semánticas de barra que el motor todavía no resuelve y no reinterpreta. */
const unsupportedMemberSemantics = (member: Space3DFrameMember): readonly string[] => {
  const fields: string[] = [];
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
    for (const field of unsupportedMemberSemantics(member)) issues.push(unsupportedSemantic('member', member.id, field));
  }
  for (const node of project.nodes) {
    if (node.internalHinge) issues.push(unsupportedSemantic('node', node.id, 'internalHinge'));
    if (node.planarSupport && node.planarSupport.type !== 'none') {
      issues.push(unsupportedSemantic('node', node.id, 'planarSupport'));
    }
  }
  const nonEmptyCollections: readonly [Space3DAnalysisIssue['entityKind'], readonly { readonly id: string }[], string][] = [
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
  // Las masas nodales son datos inertes para el cálculo estático; el modal
  // las consume sobre el mismo documento.
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
  // Failed admission must not allocate a matrix merely to return a failure.
  const stiffness: Matrix = [];
  const loadVector: readonly number[] = [];
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
    autoRestrainedDofs: Object.freeze([]),
    freeDofs: Object.freeze([]),
    elements: Object.freeze([]),
    issues: Object.freeze([...issues]),
    backend,
    profile: { position: new Int32Array(0), firstColumn: new Int32Array(0) },
  });
};

/**
 * Dense Space 3D paths need the same adaptive budget as the sparse runtime.
 * Passing n² as the non-zero count reuses the conservative arithmetic-only
 * estimate (including dense fill and solve workspace) without imposing an
 * entity-count ceiling on the model.
 */
const estimateSpace3DAnalysisBytes = (dofCount: number): number => {
  if (!Number.isSafeInteger(dofCount) || dofCount <= 0) return Number.POSITIVE_INFINITY;
  const maxSafeDimension = Math.floor(Math.sqrt(Number.MAX_SAFE_INTEGER));
  const denseEntries = dofCount <= maxSafeDimension ? dofCount * dofCount : Number.MAX_SAFE_INTEGER;
  return estimateSparseLinearSystemBytes({ dimension: dofCount, nonZeros: denseEntries });
};

/** Cota de memoria por barra: tres matrices 12×12 y sus cargas. */
const ELEMENT_BYTES = 8 * 1024;
const DOF_BYTES = 256;

/**
 * Numeración del perfil: los nudos se ordenan con Cuthill–McKee inverso sobre
 * la conectividad de las barras y sus GDL libres se numeran seguidos. La
 * primera columna de cada fila es la menor posición entre los nudos vecinos.
 */
const planSkylineProfile = (
  project: Space3DProjectV1,
  nodeIndex: ReadonlyMap<string, number>,
  restrained: ReadonlySet<number>,
  totalDofs: number,
): { position: Int32Array; firstColumn: Int32Array } => {
  const nodeCount = project.nodes.length;
  const neighbours: Set<number>[] = Array.from({ length: nodeCount }, () => new Set<number>());
  for (const member of project.members) {
    const i = nodeIndex.get(member.i);
    const j = nodeIndex.get(member.j);
    if (i === undefined || j === undefined || i === j) continue;
    neighbours[i].add(j);
    neighbours[j].add(i);
  }
  const order = reverseCuthillMcKeeOrder(neighbours.map((set) => [...set]));
  const position = new Int32Array(totalDofs).fill(-1);
  const firstOfNode = new Int32Array(nodeCount).fill(-1);
  let next = 0;
  for (const node of order) {
    for (let dof = 0; dof < DOF_PER_NODE; dof += 1) {
      const global = node * DOF_PER_NODE + dof;
      if (restrained.has(global)) continue;
      if (firstOfNode[node] < 0) firstOfNode[node] = next;
      position[global] = next;
      next += 1;
    }
  }
  const firstColumn = new Int32Array(next);
  for (let node = 0; node < nodeCount; node += 1) {
    if (firstOfNode[node] < 0) continue;
    let first = firstOfNode[node];
    for (const other of neighbours[node]) if (firstOfNode[other] >= 0 && firstOfNode[other] < first) first = firstOfNode[other];
    for (let dof = 0; dof < DOF_PER_NODE; dof += 1) {
      const row = position[node * DOF_PER_NODE + dof];
      if (row >= 0) firstColumn[row] = first;
    }
  }
  return { position, firstColumn };
};

/**
 * Cota previa del cálculo lineal en perfil, sin ordenar nada: el ancho de
 * banda de un marco reordenado crece como los nudos de una «planta»
 * (≈ n^(2/3)). La admisión fina, con el perfil real, la hace el ensamblaje.
 */
export const estimateSpace3DStaticBytes = (nodeCount: number, memberCount: number): number => {
  if (!Number.isSafeInteger(nodeCount) || !Number.isSafeInteger(memberCount) || nodeCount < 0 || memberCount < 0) return Number.POSITIVE_INFINITY;
  const dofs = nodeCount * DOF_PER_NODE;
  const band = Math.min(dofs, DOF_PER_NODE * 2 * Math.ceil(nodeCount ** (2 / 3)));
  return memberCount * ELEMENT_BYTES + dofs * DOF_BYTES + dofs * band * 8;
};

const profileSize = (firstColumn: Int32Array): number => {
  let total = 0;
  for (let row = 0; row < firstColumn.length; row += 1) total += row - firstColumn[row] + 1;
  return total;
};

/**
 * Ensambla el problema lineal estático espacial una sola vez. La salida es
 * deliberadamente explícita para que workers, auditorías y los demás modos
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

  // Los vínculos rígidos se conservan en el documento, pero el motor todavía
  // no los ensambla: se rechazan antes de tratarlos como otra cosa.
  const unsupportedMembers = project.members.filter((member) => member.type === 'rigid');
  const semantics = collectUnsupportedStaticSemantics(project);
  if (unsupportedMembers.length > 0 || semantics.length > 0) {
    const memberIssues = unsupportedMembers.map((member) => issue('unsupported-member-type', 'member', member.id, 'type'));
    return emptyStaticAssembly(targetId, target.kind, [...memberIssues, ...semantics], backend, totalDofs, nodeDofIndices);
  }

  // Primera admisión, antes de reservar nada: la densa si el consumidor la
  // pide, y si no una cota de lo que ocupan los elementos y los vectores.
  const budget = options.budget ?? createBrowserAnalysisBudget();
  const coarseBytes = options.requireDense
    ? estimateSpace3DAnalysisBytes(totalDofs)
    : project.members.length * ELEMENT_BYTES + totalDofs * DOF_BYTES;
  const admission = assessAnalysisAdmission(coarseBytes, budget);
  if (!admission.accepted) {
    return emptyStaticAssembly(
      targetId,
      target.kind,
      [issue('memory-budget', 'project', project.id, 'budget')],
      backend,
      totalDofs,
      nodeDofIndices,
    );
  }

  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  project.nodes.forEach((node, index) => {
    nodeDofIndices.set(node.id, Object.freeze(Array.from({ length: DOF_PER_NODE }, (_, dof) => index * DOF_PER_NODE + dof)));
  });
  const selfWeightFactor = space3DSelfWeightFactor(project, target.factors);
  // Un edificio lleva decenas de miles de tramos de carga: se agrupan una vez
  // por barra en lugar de recorrerlos todos por cada barra.
  const loadsByMember = new Map<string, Space3DMemberLoad[]>();
  for (const load of project.memberLoads) {
    const list = loadsByMember.get(load.memberId);
    if (list) list.push(load);
    else loadsByMember.set(load.memberId, [load]);
  }
  const diagonal = new Float64Array(totalDofs);
  const loadVector = new Array<number>(totalDofs).fill(0);
  const elements: Space3DStaticAssemblyElement[] = [];
  const elementTrace: { memberId: string; dofIndices: readonly number[]; maxStiffnessCoefficient: number }[] = [];
  const releaseIssues: Space3DAnalysisIssue[] = [];
  try {
    for (const member of project.members) {
      const i = nodeIndex.get(member.i);
      const j = nodeIndex.get(member.j);
      if (i === undefined || j === undefined) continue;
      const nodeI = project.nodes[i];
      const nodeJ = project.nodes[j];
      let element: Space3DElement;
      try {
        element = buildSpaceFrameElement(member, nodeI, nodeJ);
      } catch (error) {
        if (!(error instanceof Space3DReleaseInstabilityError)) throw error;
        releaseIssues.push(issue('mechanism', 'member', member.id, 'releases'));
        continue;
      }
      const dofIndices = Object.freeze([
        ...Array.from({ length: DOF_PER_NODE }, (_, dof) => i * DOF_PER_NODE + dof),
        ...Array.from({ length: DOF_PER_NODE }, (_, dof) => j * DOF_PER_NODE + dof),
      ]);
      for (let row = 0; row < dofIndices.length; row += 1) diagonal[dofIndices[row]] += element.globalStiffness[row][row];

      const loads = resolveSpace3DMemberLoads({
        member,
        memberLoads: loadsByMember.get(member.id) ?? [],
        start: [nodeI.x, nodeI.y, nodeI.z],
        end: [nodeJ.x, nodeJ.y, nodeJ.z],
        basis: element.basis,
        factors: target.factors,
        selfWeightFactor,
      });
      const loaded = hasSpace3DLocalLoads(loads);
      const rawFixedEndForces = loaded ? space3DFixedEndForces(loads, element.length, element.kind) : new Array<number>(12).fill(0);
      const fixedEndForces = loaded ? condenseFixedEndForces(element, rawFixedEndForces) : rawFixedEndForces;
      if (loaded) {
        // Carga nodal equivalente global: −Tᵀ f_F.
        for (let row = 0; row < 12; row += 1) {
          let value = 0;
          for (let k = 0; k < 12; k += 1) value += element.transformation[k][row] * fixedEndForces[k];
          loadVector[dofIndices[row]] -= value;
        }
      }

      elements.push(Object.freeze({
        memberId: member.id,
        nodeI: member.i,
        nodeJ: member.j,
        kind: element.kind,
        dofIndices,
        length: element.length,
        basis: element.basis,
        localStiffness: element.localStiffness,
        transformation: element.transformation,
        globalStiffness: element.globalStiffness,
        element,
        loads: loaded ? loads : EMPTY_LOCAL_LOADS,
        rawFixedEndForces,
        fixedEndForces,
        E: member.E,
        Iy: member.Iy,
        Iz: member.Iz,
      }));
      if (options.includeAssemblyTrace) elementTrace.push({ memberId: member.id, dofIndices, maxStiffnessCoefficient: Math.max(...element.globalStiffness.flat().map(Math.abs)) });
    }
  } catch (error) {
    if (error instanceof Space3DGeometryError) {
      return emptyStaticAssembly(targetId, target.kind, [issue('degenerate-orientation', 'member', '', error.code)], backend, totalDofs, nodeDofIndices);
    }
    throw error;
  }
  if (releaseIssues.length > 0) return emptyStaticAssembly(targetId, target.kind, releaseIssues, backend, totalDofs, nodeDofIndices);

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

  const userRestrained = new Set<number>();
  project.nodes.forEach((node, index) => {
    SPACE3D_DOF_KEYS.forEach((key, dof) => { if (node.restraints[key]) userRestrained.add(index * DOF_PER_NODE + dof); });
  });

  // Un GDL al que ninguna barra aporta rigidez no es un mecanismo si nada lo
  // carga: se fija, como hacen los programas comerciales con los giros de un
  // nudo de armadura. Si lo carga algo, es un mecanismo de verdad.
  const maxDiagonal = diagonal.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  const zeroTolerance = maxDiagonal * 1e-14;
  const autoRestrained: number[] = [];
  const loadedMechanisms: Space3DAnalysisIssue[] = [];
  for (let dof = 0; dof < totalDofs; dof += 1) {
    if (userRestrained.has(dof) || Math.abs(diagonal[dof]) > zeroTolerance) continue;
    if (loadVector[dof] !== 0) {
      const node = project.nodes[Math.floor(dof / DOF_PER_NODE)];
      loadedMechanisms.push(issue('mechanism', 'node', node.id, SPACE3D_DOF_KEYS[dof % DOF_PER_NODE]));
      continue;
    }
    autoRestrained.push(dof);
  }
  if (loadedMechanisms.length > 0) return emptyStaticAssembly(targetId, target.kind, loadedMechanisms, backend, totalDofs, nodeDofIndices);

  const restrainedSet = new Set([...userRestrained, ...autoRestrained]);
  const restrainedDofs = [...restrainedSet].sort((a, b) => a - b);
  const freeDofs: number[] = [];
  for (let dof = 0; dof < totalDofs; dof += 1) if (!restrainedSet.has(dof)) freeDofs.push(dof);
  const profile = planSkylineProfile(project, nodeIndex, restrainedSet, totalDofs);
  const profileEntries = profileSize(profile.firstColumn);
  const fineAdmission = assessAnalysisAdmission(
    (options.requireDense ? estimateSpace3DAnalysisBytes(totalDofs) : 0) + coarseBytes + profileEntries * 8,
    budget,
  );
  if (!fineAdmission.accepted) {
    return emptyStaticAssembly(targetId, target.kind, [issue('memory-budget', 'project', project.id, 'budget')], backend, totalDofs, nodeDofIndices);
  }

  // La rigidez densa sólo se construye si alguien la lee (modal, pandeo,
  // P-Delta, auditorías): el cálculo lineal trabaja sobre el perfil.
  let dense: Matrix | null = null;
  const denseStiffness = (): Matrix => {
    if (dense) return dense;
    const matrix = zeros(totalDofs, totalDofs);
    for (const element of elements) {
      const indices = element.dofIndices;
      for (let row = 0; row < 12; row += 1) {
        const target = matrix[indices[row]];
        const source = element.globalStiffness[row];
        for (let col = 0; col < 12; col += 1) target[indices[col]] += source[col];
      }
    }
    dense = matrix;
    return matrix;
  };

  const assemblyTrace = options.includeAssemblyTrace ? Object.freeze(elementTrace) : undefined;
  return Object.freeze({
    valid: true,
    targetId,
    targetKind: target.kind,
    totalDofs,
    get stiffness() { return denseStiffness(); },
    loadVector,
    get K() { return denseStiffness(); },
    F: loadVector,
    profile,
    nodeDofIndices,
    restrainedDofs: Object.freeze(restrainedDofs),
    autoRestrainedDofs: Object.freeze(autoRestrained),
    freeDofs: Object.freeze(freeDofs),
    elements: Object.freeze(elements),
    issues: Object.freeze([]),
    backend,
    ...(assemblyTrace ? { assemblyTrace } : {}),
  });
};

/**
 * Resultado completo a partir de un campo de desplazamientos: reacciones,
 * acciones de extremo con sus cargas de barra, estaciones y equilibrio. Lo
 * comparten el análisis lineal y los modos que reutilizan el ensamblaje.
 */
export const recoverSpace3DResult = (
  project: Space3DProjectV1,
  assembly: Space3DStaticAssembly,
  /** Rigidez con la que se resolvió (P-Delta la modifica); `null` usa la de las barras. */
  stiffness: Matrix | null,
  displacement: readonly number[],
  solve: { readonly relativeResidual: number; readonly conditionEstimate: number },
  options: Pick<Space3DStaticAnalysisOptions, 'stationSegments'> & {
    /**
     * Vector de cargas nodales distinto del del objetivo (una carga unitaria de
     * influencia). Con él, las barras no llevan las cargas del objetivo.
     */
    readonly loadVector?: readonly number[];
  } = {},
): Space3DAnalysisResult => {
  const loadVector = options.loadVector ?? assembly.loadVector;
  const withMemberLoads = options.loadVector === undefined;
  const product = stiffness ? multiplyMatrixVector(stiffness, [...displacement]) : elementStiffnessProduct(assembly, displacement);
  const rawReactions = product.map((value, index) => value - (loadVector[index] ?? 0));
  const restrained = new Set(assembly.restrainedDofs);
  const reactions = rawReactions.map((value, index) => (restrained.has(index) ? value : 0));

  const nodeResults: Space3DNodeResult[] = project.nodes.map((node, index) => Object.freeze({
    nodeId: node.id,
    displacement: dofValues(displacement, index * DOF_PER_NODE),
    reaction: dofValues(reactions, index * DOF_PER_NODE),
  }));

  const memberResults: Space3DMemberResult[] = assembly.elements.map((element) => {
    const uElement = element.dofIndices.map((index) => displacement[index] ?? 0);
    const uLocal = multiplyMatrixVector(element.transformation, uElement);
    const stiffnessForces = multiplyMatrixVector(element.localStiffness, uLocal);
    const fixedEnd = withMemberLoads ? element.fixedEndForces : ZERO_END_FORCES;
    const fLocal = stiffnessForces.map((value, index) => value + fixedEnd[index]);
    const memberEnds = recoverMemberEndDisplacements(element.element, uLocal, withMemberLoads ? element.rawFixedEndForces : ZERO_END_FORCES);
    const stations = computeSpace3DMemberStations({
      length: element.length,
      kind: element.kind,
      E: element.E,
      Iy: element.Iy,
      Iz: element.Iz,
      endForces: fLocal,
      endDisplacements: memberEnds,
      loads: withMemberLoads ? element.loads : EMPTY_LOCAL_LOADS,
      segments: options.stationSegments,
    });
    return Object.freeze({
      memberId: element.memberId,
      length: element.length,
      basis: element.basis,
      start: endForces(fLocal, 0),
      end: endForces(fLocal, 6),
      stations,
    });
  });

  const equilibrium = auditEquilibrium(project, nodeResults, loadVector);
  const userRestrainedCount = assembly.restrainedDofs.length - assembly.autoRestrainedDofs.length;
  const diagnostics: Space3DAnalysisDiagnostics = Object.freeze({
    dofCount: assembly.totalDofs,
    freeDofCount: assembly.freeDofs.length,
    restrainedDofCount: userRestrainedCount,
    relativeResidual: solve.relativeResidual,
    conditionEstimate: solve.conditionEstimate,
    equilibrium,
    ...(assembly.autoRestrainedDofs.length > 0 ? { autoRestrainedDofCount: assembly.autoRestrainedDofs.length } : {}),
  });

  return Object.freeze({
    success: true,
    targetId: assembly.targetId,
    targetKind: assembly.targetKind,
    nodeResults: Object.freeze(nodeResults),
    memberResults: Object.freeze(memberResults),
    issues: Object.freeze([]),
    diagnostics,
  });
};

/** `K·u` barra a barra, sin formar la matriz global. */
const elementStiffnessProduct = (assembly: Space3DStaticAssembly, displacement: readonly number[]): number[] => {
  const result = new Array<number>(assembly.totalDofs).fill(0);
  for (const element of assembly.elements) {
    const indices = element.dofIndices;
    for (let row = 0; row < 12; row += 1) {
      const source = element.globalStiffness[row];
      let sum = 0;
      for (let col = 0; col < 12; col += 1) sum += source[col] * (displacement[indices[col]] ?? 0);
      result[indices[row]] += sum;
    }
  }
  return result;
};

/**
 * Estimación de Hager de ‖K⁻¹‖₁ con la factorización ya hecha; por simetría
 * la resolución con Kᵀ es la misma.
 */
const estimateInverseNorm = (factorization: Space3DSkylineFactorization): number => {
  const n = factorization.n;
  let x = new Float64Array(n).fill(1 / n);
  let estimate = 0;
  let previous = -1;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const y = factorization.solve(x);
    estimate = Math.max(estimate, y.reduce((sum, value) => sum + Math.abs(value), 0));
    const z = factorization.solve(y.map((value) => (value >= 0 ? 1 : -1)));
    let index = 0;
    for (let i = 1; i < n; i += 1) if (Math.abs(z[i]) > Math.abs(z[index])) index = i;
    if (index === previous) break;
    previous = index;
    x = new Float64Array(n);
    x[index] = 1;
  }
  return estimate;
};

/** Punto de entrada estático: ensamblar una vez, resolver en perfil y recuperar. */
export const analyzeSpace3DProject = (
  project: Space3DProjectV1,
  targetId: string,
  options: Space3DStaticAnalysisOptions = {},
): Space3DAnalysisResult => {
  const assembly = assembleSpace3DStaticModel(project, targetId, options);
  if (!assembly.valid) return failed(targetId, assembly.targetKind, assembly.issues);
  const { position, firstColumn } = assembly.profile;
  const n = firstColumn.length;
  // Todo restringido no es un error: los desplazamientos son nulos y las
  // reacciones equilibran las cargas (una viga biempotrada aislada).
  if (n === 0) {
    return recoverSpace3DResult(project, assembly, null, new Array<number>(assembly.totalDofs).fill(0), { relativeResidual: 0, conditionEstimate: 1 }, options);
  }

  const matrix = createSkylineMatrix(firstColumn);
  for (const element of assembly.elements) {
    const rows = element.dofIndices.map((dof) => position[dof]);
    for (let a = 0; a < 12; a += 1) {
      const row = rows[a];
      if (row < 0) continue;
      const source = element.globalStiffness[a];
      for (let b = 0; b < 12; b += 1) {
        const column = rows[b];
        if (column < 0 || column > row) continue;
        const value = source[b];
        if (value !== 0) addToSkyline(matrix, row, column, value);
      }
    }
  }
  const rhs = new Float64Array(n);
  for (let dof = 0; dof < assembly.totalDofs; dof += 1) if (position[dof] >= 0) rhs[position[dof]] = assembly.loadVector[dof];
  const matrixNorm = skylineInfinityNorm(matrix);

  let factorization: Space3DSkylineFactorization;
  try {
    factorization = factorizeSkyline(matrix);
  } catch (error) {
    if (!(error instanceof Space3DSingularMatrixError)) throw error;
    const dof = position.indexOf(error.row);
    const node = dof >= 0 ? project.nodes[Math.floor(dof / DOF_PER_NODE)] : undefined;
    return failed(targetId, assembly.targetKind, [node
      ? issue('mechanism', 'node', node.id, SPACE3D_DOF_KEYS[dof % DOF_PER_NODE])
      : issue('mechanism', 'project', '')]);
  }

  const toGlobal = (reduced: Float64Array): number[] => {
    const full = new Array<number>(assembly.totalDofs).fill(0);
    for (let dof = 0; dof < assembly.totalDofs; dof += 1) if (position[dof] >= 0) full[dof] = reduced[position[dof]];
    return full;
  };
  const residualOf = (full: readonly number[]): { residual: Float64Array; relative: number } => {
    const product = elementStiffnessProduct(assembly, full);
    const residual = new Float64Array(n);
    let numerator = 0;
    let xNorm = 0;
    let bNorm = 0;
    for (let dof = 0; dof < assembly.totalDofs; dof += 1) {
      const row = position[dof];
      if (row < 0) continue;
      residual[row] = rhs[row] - product[dof];
      numerator = Math.max(numerator, Math.abs(residual[row]));
      xNorm = Math.max(xNorm, Math.abs(full[dof]));
      bNorm = Math.max(bNorm, Math.abs(rhs[row]));
    }
    return { residual, relative: numerator / Math.max(Number.MIN_VALUE, matrixNorm * xNorm + bNorm) };
  };

  let reduced = factorization.solve(rhs);
  let displacement = toGlobal(reduced);
  let check = residualOf(displacement);
  // Un paso de refinamiento iterativo: barato con la factorización hecha.
  if (check.relative > 1e-12) {
    const correction = factorization.solve(check.residual);
    const candidate = reduced.map((value, index) => value + correction[index]);
    const candidateDisplacement = toGlobal(candidate);
    const candidateCheck = residualOf(candidateDisplacement);
    if (candidateCheck.relative < check.relative) {
      reduced = candidate;
      displacement = candidateDisplacement;
      check = candidateCheck;
    }
  }
  if (displacement.some((value) => !Number.isFinite(value)) || !Number.isFinite(check.relative)) {
    return failed(targetId, assembly.targetKind, [issue('non-finite-solution', 'project', '')]);
  }
  const conditionEstimate = matrixNorm * estimateInverseNorm(factorization);
  return recoverSpace3DResult(project, assembly, null, displacement, { relativeResidual: check.relative, conditionEstimate }, options);
};
