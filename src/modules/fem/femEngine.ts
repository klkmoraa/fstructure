/**
 * Núcleo FEM local y serializable de la primera entrega.
 *
 * El documento es independiente del modelo 2D/3D y no tiene topes de nodos o
 * elementos. La admisión de memoria pertenece al runtime común; este módulo
 * sólo valida geometría y resuelve elasticidad lineal de esfuerzo plano para
 * TRI3/QUAD4. MITC4 y TET4 se conservan en el codec, pero fallan cerrado hasta
 * que exista su formulación física.
 */
import {
  multiplyMatrixVector,
  solveLinearSystem,
  submatrix,
  zeros,
  type Matrix,
} from '../../foundation/linearAlgebra';
import {
  assessAnalysisAdmission,
  createBrowserAnalysisBudget,
  estimateSparseLinearSystemBytes,
} from '../../numeric/admission';
import type { AnalysisBudget } from '../../shared/contracts';

export type FemElementType = 'TRI3' | 'QUAD4' | 'MITC4' | 'TET4';
export type FemAnalysisKind = 'plane-stress' | 'plane-strain' | 'shell' | 'solid';

export interface FemNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export interface FemElement {
  readonly id: string;
  readonly type: FemElementType;
  readonly nodeIds: readonly string[];
}

export interface FemMaterial {
  readonly id: string;
  readonly E: number;
  readonly nu: number;
  readonly thickness?: number;
}

export interface FemNodalLoad {
  readonly id: string;
  readonly nodeId: string;
  readonly fx: number;
  readonly fy: number;
  readonly fz?: number;
}

export interface FemNodalRestraint {
  readonly nodeId: string;
  readonly ux?: boolean;
  readonly uy?: boolean;
  readonly uz?: boolean;
}

export interface FemDocumentV1 {
  readonly kind: 'fem-document';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly analysis: FemAnalysisKind;
  readonly material: FemMaterial;
  readonly nodes: readonly FemNode[];
  readonly elements: readonly FemElement[];
  readonly loads: readonly FemNodalLoad[];
  readonly restraints: readonly FemNodalRestraint[];
}

export interface FemValidationIssue {
  readonly code: 'invalid-value' | 'duplicate-id' | 'missing-reference' | 'unsupported-element' | 'unsupported-analysis' | 'unsupported-load' | 'degenerate-element' | 'empty-model' | 'memory-budget';
  readonly entity: 'document' | 'node' | 'element' | 'load' | 'restraint';
  readonly id: string;
  readonly field: string;
}

export interface FemDisplacement {
  readonly nodeId: string;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
}

export interface FemStressResult {
  readonly elementId: string;
  readonly type: FemElementType;
  readonly strain: readonly [number, number, number];
  readonly stress: readonly [number, number, number];
  readonly outOfPlaneStress?: number;
  readonly principal: readonly [number, number];
  readonly vonMises: number;
}

export interface FemMeshQuality {
  readonly valid: boolean;
  readonly minArea: number;
  readonly maxAspectRatio: number;
  readonly degenerateElementIds: readonly string[];
}

export interface FemEquilibriumAudit {
  readonly force: readonly [number, number, number];
  readonly normalized: number | null;
}

export interface FemAnalysisResult {
  readonly success: boolean;
  readonly documentId: string;
  readonly displacements: readonly FemDisplacement[];
  readonly reactions: readonly FemDisplacement[];
  readonly stresses: readonly FemStressResult[];
  readonly meshQuality: FemMeshQuality;
  readonly equilibrium: FemEquilibriumAudit;
  readonly relativeResidual: number | null;
  readonly conditionEstimate: number | null;
  readonly issues: readonly FemValidationIssue[];
  readonly reason: string;
}

export interface FemOpenBundleV1 {
  readonly format: 'fstructure-fem-bundle';
  readonly formatVersion: 1;
  readonly document: FemDocumentV1;
  readonly analysis?: FemAnalysisResult;
}

const TRI3_NODE_COUNT = 3;
const QUAD4_NODE_COUNT = 4;
const SUPPORTED_ELEMENT_TYPES = new Set<FemElementType>(['TRI3', 'QUAD4']);

const issue = (
  code: FemValidationIssue['code'],
  entity: FemValidationIssue['entity'],
  id: string,
  field: string,
): FemValidationIssue => ({ code, entity, id, field });

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const planeStressMatrix = (E: number, nu: number): Matrix => {
  const factor = E / (1 - nu * nu);
  return [
    [factor, factor * nu, 0],
    [factor * nu, factor, 0],
    [0, 0, factor * (1 - nu) / 2],
  ];
};

const planeStrainMatrix = (E: number, nu: number): Matrix => {
  const factor = E / ((1 + nu) * (1 - 2 * nu));
  return [
    [factor * (1 - nu), factor * nu, 0],
    [factor * nu, factor * (1 - nu), 0],
    [0, 0, factor * (1 - 2 * nu) / 2],
  ];
};

const constitutiveMatrix = (material: FemMaterial, analysis: FemAnalysisKind): Matrix =>
  analysis === 'plane-strain' ? planeStrainMatrix(material.E, material.nu) : planeStressMatrix(material.E, material.nu);

const addElementMatrix = (global: Matrix, local: Matrix, indices: readonly number[]): void => {
  indices.forEach((row, i) => indices.forEach((column, j) => { global[row][column] += local[i][j]; }));
};

const multiplyBDB = (B: Matrix, D: Matrix, thickness: number, weight: number): Matrix => {
  const result = zeros(B[0]?.length ?? 0, B[0]?.length ?? 0);
  for (let i = 0; i < result.length; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      for (let a = 0; a < 3; a += 1) for (let b = 0; b < 3; b += 1) result[i][j] += B[a][i] * D[a][b] * B[b][j] * thickness * weight;
    }
  }
  return result;
};

const triangleGeometry = (nodes: readonly FemNode[]): { area: number; signedArea2: number; B: Matrix; aspectRatio: number } | null => {
  if (nodes.length !== TRI3_NODE_COUNT) return null;
  const [n1, n2, n3] = nodes;
  const signedArea2 = (n2.x - n1.x) * (n3.y - n1.y) - (n3.x - n1.x) * (n2.y - n1.y);
  const area = Math.abs(signedArea2) / 2;
  if (!(area > 0)) return null;
  const B: Matrix = [
    [n2.y - n3.y, 0, n3.y - n1.y, 0, n1.y - n2.y, 0],
    [0, n3.x - n2.x, 0, n1.x - n3.x, 0, n2.x - n1.x],
    [n3.x - n2.x, n2.y - n3.y, n1.x - n3.x, n3.y - n1.y, n2.x - n1.x, n1.y - n2.y],
  ].map((row) => row.map((value) => value / signedArea2));
  const edge = (a: FemNode, b: FemNode) => Math.hypot(a.x - b.x, a.y - b.y);
  const lengths = [edge(n1, n2), edge(n2, n3), edge(n3, n1)];
  const aspectRatio = Math.max(...lengths) / Math.max(Math.min(...lengths), Number.MIN_VALUE);
  return { area, signedArea2, B, aspectRatio };
};

const quadPoint = (nodes: readonly FemNode[], xi: number, eta: number): { B: Matrix; detJ: number } | null => {
  if (nodes.length !== QUAD4_NODE_COUNT) return null;
  const dXi = [-(1 - eta) / 4, (1 - eta) / 4, (1 + eta) / 4, -(1 + eta) / 4];
  const dEta = [-(1 - xi) / 4, -(1 + xi) / 4, (1 + xi) / 4, (1 - xi) / 4];
  let j11 = 0; let j12 = 0; let j21 = 0; let j22 = 0;
  for (let i = 0; i < QUAD4_NODE_COUNT; i += 1) {
    j11 += dXi[i] * nodes[i].x; j12 += dEta[i] * nodes[i].x;
    j21 += dXi[i] * nodes[i].y; j22 += dEta[i] * nodes[i].y;
  }
  const detJ = j11 * j22 - j12 * j21;
  const edgeScale = Math.max(
    ...nodes.map((node, index) => Math.hypot(node.x - nodes[(index + 1) % QUAD4_NODE_COUNT].x, node.y - nodes[(index + 1) % QUAD4_NODE_COUNT].y)),
    Number.MIN_VALUE,
  );
  const detTolerance = edgeScale * edgeScale * 1e-12;
  if (!Number.isFinite(detJ) || Math.abs(detJ) <= detTolerance) return null;
  const B = zeros(3, 8);
  for (let i = 0; i < QUAD4_NODE_COUNT; i += 1) {
    const dX = (j22 * dXi[i] - j12 * dEta[i]) / detJ;
    const dY = (-j21 * dXi[i] + j11 * dEta[i]) / detJ;
    B[0][i * 2] = dX;
    B[1][i * 2 + 1] = dY;
    B[2][i * 2] = dY;
    B[2][i * 2 + 1] = dX;
  }
  return { B, detJ };
};

const orientation = (a: FemNode, b: FemNode, c: FemNode): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const onSegment = (a: FemNode, b: FemNode, c: FemNode, orientationTolerance: number, coordinateTolerance: number): boolean =>
  Math.abs(orientation(a, b, c)) <= orientationTolerance
  && c.x >= Math.min(a.x, b.x) - coordinateTolerance
  && c.x <= Math.max(a.x, b.x) + coordinateTolerance
  && c.y >= Math.min(a.y, b.y) - coordinateTolerance
  && c.y <= Math.max(a.y, b.y) + coordinateTolerance;

const segmentsIntersect = (a: FemNode, b: FemNode, c: FemNode, d: FemNode): boolean => {
  const scale = Math.max(
    Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(b.x - c.x, b.y - c.y),
    Math.hypot(c.x - d.x, c.y - d.y), Math.hypot(d.x - a.x, d.y - a.y),
    Math.hypot(a.x - c.x, a.y - c.y), Math.hypot(b.x - d.x, b.y - d.y), Number.MIN_VALUE,
  );
  const tolerance = scale * scale * 1e-12;
  const coordinateTolerance = scale * 1e-12;
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  if (((abc > tolerance && abd < -tolerance) || (abc < -tolerance && abd > tolerance))
    && ((cda > tolerance && cdb < -tolerance) || (cda < -tolerance && cdb > tolerance))) return true;
  return onSegment(a, b, c, tolerance, coordinateTolerance) || onSegment(a, b, d, tolerance, coordinateTolerance)
    || onSegment(c, d, a, tolerance, coordinateTolerance) || onSegment(c, d, b, tolerance, coordinateTolerance);
};

const quadIsSimple = (nodes: readonly FemNode[]): boolean =>
  nodes.length === QUAD4_NODE_COUNT
  && !segmentsIntersect(nodes[0], nodes[1], nodes[2], nodes[3])
  && !segmentsIntersect(nodes[1], nodes[2], nodes[3], nodes[0]);

const quadAreaAndAspect = (nodes: readonly FemNode[]): { area: number; aspectRatio: number } => {
  if (!quadIsSimple(nodes)) return { area: 0, aspectRatio: Number.POSITIVE_INFINITY };
  const first = triangleGeometry([nodes[0], nodes[1], nodes[2]]);
  const second = triangleGeometry([nodes[0], nodes[2], nodes[3]]);
  const area = (first?.area ?? 0) + (second?.area ?? 0);
  const edges = nodes.map((node, index) => Math.hypot(node.x - nodes[(index + 1) % nodes.length].x, node.y - nodes[(index + 1) % nodes.length].y));
  return { area, aspectRatio: Math.max(...edges) / Math.max(Math.min(...edges), Number.MIN_VALUE) };
};

const nodeMap = (document: FemDocumentV1): Map<string, FemNode> => new Map(document.nodes.map((node) => [node.id, node]));

export const validateFemDocument = (document: FemDocumentV1): readonly FemValidationIssue[] => {
  const issues: FemValidationIssue[] = [];
  if (!document || document.kind !== 'fem-document' || document.schemaVersion !== 1) issues.push(issue('invalid-value', 'document', '', 'schemaVersion'));
  if (!document || typeof document.id !== 'string' || !document.id) issues.push(issue('invalid-value', 'document', '', 'id'));
  const nodeList = Array.isArray(document?.nodes) ? document.nodes : [];
  const elementList = Array.isArray(document?.elements) ? document.elements : [];
  const loadList = Array.isArray(document?.loads) ? document.loads : [];
  const restraintList = Array.isArray(document?.restraints) ? document.restraints : [];
  if (!nodeList.length || !elementList.length) issues.push(issue('empty-model', 'document', document?.id ?? '', 'elements'));
  if (document && !Array.isArray(document.nodes)) issues.push(issue('invalid-value', 'document', document.id ?? '', 'nodes'));
  if (document && !Array.isArray(document.elements)) issues.push(issue('invalid-value', 'document', document.id ?? '', 'elements'));
  if (document && !Array.isArray(document.loads)) issues.push(issue('invalid-value', 'document', document.id ?? '', 'loads'));
  if (document && !Array.isArray(document.restraints)) issues.push(issue('invalid-value', 'document', document.id ?? '', 'restraints'));
  if (!document || !['plane-stress', 'plane-strain'].includes(document.analysis)) issues.push(issue('unsupported-analysis', 'document', document?.id ?? '', 'analysis'));
  if (!document?.material || !finite(document.material.E) || document.material.E <= 0) issues.push(issue('invalid-value', 'document', document?.id ?? '', 'material.E'));
  if (!document?.material || !finite(document.material.nu) || document.material.nu <= -1 || document.material.nu >= 0.5) issues.push(issue('invalid-value', 'document', document?.id ?? '', 'material.nu'));
  if (document?.material?.thickness !== undefined && (!finite(document.material.thickness) || document.material.thickness <= 0)) issues.push(issue('invalid-value', 'document', document?.id ?? '', 'material.thickness'));
  const nodes = new Set<string>();
  for (const node of nodeList) {
    if (!node || typeof node !== 'object') { issues.push(issue('invalid-value', 'node', '', '$entity')); continue; }
    if (nodes.has(node.id)) issues.push(issue('duplicate-id', 'node', node.id, 'id'));
    nodes.add(node.id);
    if (!node.id || !finite(node.x) || !finite(node.y) || (node.z !== undefined && !finite(node.z))) issues.push(issue('invalid-value', 'node', node.id ?? '', 'coordinate'));
  }
  const elements = new Set<string>();
  for (const element of elementList) {
    if (!element || typeof element !== 'object') { issues.push(issue('invalid-value', 'element', '', '$entity')); continue; }
    if (elements.has(element.id)) issues.push(issue('duplicate-id', 'element', element.id, 'id'));
    elements.add(element.id);
    if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) issues.push(issue('unsupported-element', 'element', element.id, 'type'));
    const expected = element.type === 'TRI3' ? TRI3_NODE_COUNT : element.type === 'QUAD4' ? QUAD4_NODE_COUNT : 0;
    if (!Array.isArray(element.nodeIds)) { issues.push(issue('invalid-value', 'element', element.id, 'nodeIds')); continue; }
    if (expected > 0 && element.nodeIds.length !== expected) issues.push(issue('invalid-value', 'element', element.id, 'nodeIds'));
    if (element.nodeIds.some((id: unknown) => typeof id !== 'string' || !nodes.has(id))) issues.push(issue('missing-reference', 'element', element.id, 'nodeIds'));
  }
  const loadIds = new Set<string>();
  for (const load of loadList) {
    if (!load || typeof load !== 'object') { issues.push(issue('invalid-value', 'load', '', '$entity')); continue; }
    if (loadIds.has(load.id)) issues.push(issue('duplicate-id', 'load', load.id, 'id'));
    loadIds.add(load.id);
    if (!nodes.has(load.nodeId)) issues.push(issue('missing-reference', 'load', load.id, 'nodeId'));
    if (!finite(load.fx) || !finite(load.fy) || (load.fz !== undefined && !finite(load.fz))) issues.push(issue('invalid-value', 'load', load.id, 'components'));
    if ((load.fz ?? 0) !== 0) issues.push(issue('unsupported-load', 'load', load.id, 'fz'));
  }
  for (const restraint of restraintList) {
    if (!restraint || typeof restraint !== 'object') { issues.push(issue('invalid-value', 'restraint', '', '$entity')); continue; }
    if (!nodes.has(restraint.nodeId)) issues.push(issue('missing-reference', 'restraint', restraint.nodeId, 'nodeId'));
    if (restraint.uz) issues.push(issue('unsupported-load', 'restraint', restraint.nodeId, 'uz'));
  }
  return issues;
};

export const createTri3PatchFixture = (): FemDocumentV1 => ({
  kind: 'fem-document', schemaVersion: 1, id: 'fem-tri3-patch', name: 'TRI3 patch', analysis: 'plane-stress',
  material: { id: 'steel', E: 200_000_000, nu: 0.3, thickness: 0.1 },
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 1, y: 0 }, { id: '3', x: 0, y: 1 }],
  elements: [{ id: 'E1', type: 'TRI3', nodeIds: ['1', '2', '3'] }],
  loads: [{ id: 'L1', nodeId: '2', fx: 10, fy: 0 }],
  restraints: [{ nodeId: '1', ux: true, uy: true }, { nodeId: '3', ux: true, uy: true }],
});

const emptyResult = (documentId: string, issues: readonly FemValidationIssue[], reason: string, degenerateElementIds: readonly string[] = []): FemAnalysisResult => Object.freeze({
  success: false, documentId, displacements: Object.freeze([]), reactions: Object.freeze([]), stresses: Object.freeze([]),
  meshQuality: Object.freeze({ valid: false, minArea: 0, maxAspectRatio: 0, degenerateElementIds: Object.freeze([...degenerateElementIds]) }),
  equilibrium: Object.freeze({ force: Object.freeze([0, 0, 0] as readonly [number, number, number]), normalized: null }),
  relativeResidual: null, conditionEstimate: null, issues: Object.freeze([...issues]), reason,
});

const principalAndVonMises = (sx: number, sy: number, txy: number, sz = 0): { principal: readonly [number, number]; vonMises: number } => {
  const center = (sx + sy) / 2;
  const radius = Math.hypot((sx - sy) / 2, txy);
  const principalValues = [center + radius, center - radius, sz];
  const vonMisesSquared = ((sx - sy) ** 2 + (sy - sz) ** 2 + (sz - sx) ** 2) / 2 + 3 * txy * txy;
  return { principal: [Math.max(...principalValues), Math.min(...principalValues)], vonMises: Math.sqrt(Math.max(0, vonMisesSquared)) };
};

export interface FemAnalysisOptions {
  readonly budget?: AnalysisBudget;
}

const estimateFemAnalysisBytes = (ndof: number): number => {
  if (!Number.isSafeInteger(ndof) || ndof <= 0) return Number.POSITIVE_INFINITY;
  const maxSafeDimension = Math.floor(Math.sqrt(Number.MAX_SAFE_INTEGER));
  const denseEntries = ndof <= maxSafeDimension ? ndof * ndof : Number.MAX_SAFE_INTEGER;
  return estimateSparseLinearSystemBytes({ dimension: ndof, nonZeros: denseEntries });
};

export const analyzeFemDocument = (document: FemDocumentV1, options: FemAnalysisOptions = {}): FemAnalysisResult => {
  const issues = validateFemDocument(document);
  if (issues.length > 0) return emptyResult(document?.id ?? '', issues, 'El documento FEM no es admisible.');
  const nodesById = nodeMap(document);
  const material = document.material;
  const thickness = material.thickness ?? 1;
  const D = constitutiveMatrix(material, document.analysis);
  const nodeIndex = new Map(document.nodes.map((node, index) => [node.id, index]));
  const ndof = document.nodes.length * 2;
  const budget = options.budget ?? createBrowserAnalysisBudget();
  const admission = assessAnalysisAdmission(estimateFemAnalysisBytes(ndof), budget);
  if (!admission.accepted) return emptyResult(document.id, [issue('memory-budget', 'document', document.id, 'budget')], `El análisis requiere aproximadamente ${(admission.estimatedBytes / (1024 * 1024)).toFixed(1)} MiB; el presupuesto local es ${(admission.availableBytes / (1024 * 1024)).toFixed(1)} MiB.`);
  const K = zeros(ndof, ndof);
  const elementData: Array<{ element: FemElement; nodes: FemNode[]; B: Matrix; area: number; aspectRatio: number }> = [];
  let minArea = Number.POSITIVE_INFINITY;
  let maxAspectRatio = 0;
  const degenerateElementIds: string[] = [];

  for (const element of document.elements) {
    const elementNodes = element.nodeIds.map((id) => nodesById.get(id)!);
    if (element.type === 'TRI3') {
      const geometry = triangleGeometry(elementNodes);
      if (!geometry) { degenerateElementIds.push(element.id); continue; }
      const local = multiplyBDB(geometry.B, D, thickness, geometry.area);
      addElementMatrix(K, local, elementNodes.flatMap((node) => { const base = nodeIndex.get(node.id)! * 2; return [base, base + 1]; }));
      elementData.push({ element, nodes: elementNodes, B: geometry.B, area: geometry.area, aspectRatio: geometry.aspectRatio });
      minArea = Math.min(minArea, geometry.area); maxAspectRatio = Math.max(maxAspectRatio, geometry.aspectRatio);
    } else if (element.type === 'QUAD4') {
      const local = zeros(8, 8);
      const gauss = 1 / Math.sqrt(3);
      let centerB: Matrix | null = null;
      let area = 0;
      let invalidJacobian = !quadIsSimple(elementNodes);
      let orientationSign: number | null = null;
      for (const xi of [-gauss, gauss]) for (const eta of [-gauss, gauss]) {
        const point = quadPoint(elementNodes, xi, eta);
        if (!point) { invalidJacobian = true; continue; }
        const sign = Math.sign(point.detJ);
        if (orientationSign === null) orientationSign = sign;
        else if (sign !== orientationSign) invalidJacobian = true;
        addElementMatrix(local, multiplyBDB(point.B, D, thickness, Math.abs(point.detJ)), Array.from({ length: 8 }, (_, index) => index));
        area += Math.abs(point.detJ);
      }
      centerB = quadPoint(elementNodes, 0, 0)?.B ?? null;
      const quality = quadAreaAndAspect(elementNodes);
      if (invalidJacobian || !(area > 0) || !centerB || !(quality.area > 0)) { degenerateElementIds.push(element.id); continue; }
      addElementMatrix(K, local, elementNodes.flatMap((node) => { const base = nodeIndex.get(node.id)! * 2; return [base, base + 1]; }));
      elementData.push({ element, nodes: elementNodes, B: centerB, area: quality.area, aspectRatio: quality.aspectRatio });
      minArea = Math.min(minArea, quality.area); maxAspectRatio = Math.max(maxAspectRatio, quality.aspectRatio);
    }
  }
  if (degenerateElementIds.length > 0) return emptyResult(document.id, degenerateElementIds.map((id) => issue('degenerate-element', 'element', id, 'geometry')), 'La malla contiene elementos degenerados.', degenerateElementIds);
  const F = Array.from({ length: ndof }, () => 0);
  for (const load of document.loads) {
    const index = nodeIndex.get(load.nodeId);
    if (index === undefined) continue;
    F[index * 2] += load.fx;
    F[index * 2 + 1] += load.fy;
  }
  const restrained = new Set<number>();
  for (const restraint of document.restraints) {
    const index = nodeIndex.get(restraint.nodeId);
    if (index === undefined) continue;
    if (restraint.ux) restrained.add(index * 2);
    if (restraint.uy) restrained.add(index * 2 + 1);
  }
  const free = Array.from({ length: ndof }, (_, index) => index).filter((index) => !restrained.has(index));
  let solved: Pick<ReturnType<typeof solveLinearSystem>, 'x' | 'relativeResidual' | 'conditionEstimate'>;
  if (!free.length) solved = { x: [], relativeResidual: 0, conditionEstimate: 1 };
  else {
    try {
      solved = solveLinearSystem(submatrix(K, free, free), free.map((index) => F[index]));
    } catch (error) {
      return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'stiffness')], error instanceof Error ? error.message : 'La rigidez FEM es singular.');
    }
  }
  if (!solved.x.every(Number.isFinite) || !Number.isFinite(solved.relativeResidual) || !Number.isFinite(solved.conditionEstimate)) {
    return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'stiffness')], 'El análisis produjo valores numéricos no finitos.');
  }
  const U = Array.from({ length: ndof }, () => 0);
  free.forEach((global, index) => { U[global] = solved.x[index]; });
  const reactionsVector = multiplyMatrixVector(K, U).map((value, index) => restrained.has(index) ? value - F[index] : 0);
  if (!U.every(Number.isFinite) || !reactionsVector.every(Number.isFinite)) return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'response')], 'El análisis produjo una respuesta no finita.');
  const displacements = document.nodes.map((node, index) => Object.freeze({ nodeId: node.id, ux: U[index * 2], uy: U[index * 2 + 1], uz: 0 }));
  const reactions = document.nodes.map((node, index) => Object.freeze({ nodeId: node.id, ux: reactionsVector[index * 2], uy: reactionsVector[index * 2 + 1], uz: 0 }));
  const stresses = elementData.map(({ element, nodes: elementNodes, B }) => {
    const localU = elementNodes.flatMap((node) => { const base = nodeIndex.get(node.id)! * 2; return [U[base], U[base + 1]]; });
    const strainVector = multiplyMatrixVector(B, localU);
    const stressVector = multiplyMatrixVector(D, strainVector);
    const outOfPlaneStress = document.analysis === 'plane-strain' ? material.nu * (stressVector[0] + stressVector[1]) : 0;
    const invariants = principalAndVonMises(stressVector[0], stressVector[1], stressVector[2], outOfPlaneStress);
    return Object.freeze({ elementId: element.id, type: element.type, strain: [strainVector[0], strainVector[1], strainVector[2]] as const, stress: [stressVector[0], stressVector[1], stressVector[2]] as const, outOfPlaneStress, principal: invariants.principal, vonMises: invariants.vonMises });
  });
  if (stresses.some((stress) => [...stress.strain, ...stress.stress, stress.outOfPlaneStress ?? 0, ...stress.principal, stress.vonMises].some((value) => !Number.isFinite(value)))) {
    return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'stress')], 'El análisis produjo tensiones no finitas.');
  }
  // `scale` es la mayor magnitud en juego, no un mínimo de 1: arrancarlo en 1
  // volvía la métrica absoluta en modelos de carga pequeña, donde cualquier
  // desequilibrio quedaba dividido por 1 y pasaba el umbral sin ser relativo.
  let fx = 0; let fy = 0; let fz = 0; let scale = 0;
  for (const load of document.loads) { fx += load.fx; fy += load.fy; fz += load.fz ?? 0; scale = Math.max(scale, Math.abs(load.fx), Math.abs(load.fy), Math.abs(load.fz ?? 0)); }
  reactions.forEach((reaction) => { fx += reaction.ux; fy += reaction.uy; fz += reaction.uz; scale = Math.max(scale, Math.abs(reaction.ux), Math.abs(reaction.uy), Math.abs(reaction.uz)); });
  if (![fx, fy, fz, scale].every(Number.isFinite)) return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'equilibrium')], 'El análisis produjo un equilibrio no finito.');
  return Object.freeze({
    success: true,
    documentId: document.id,
    displacements: Object.freeze(displacements),
    reactions: Object.freeze(reactions),
    stresses: Object.freeze(stresses),
    meshQuality: Object.freeze({ valid: minArea > 0, minArea: Number.isFinite(minArea) ? minArea : 0, maxAspectRatio, degenerateElementIds: Object.freeze([]) }),
    equilibrium: Object.freeze({ force: Object.freeze([fx, fy, fz] as readonly [number, number, number]), normalized: scale > 0 ? Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fz)) / scale : 0 }),
    relativeResidual: solved.relativeResidual,
    conditionEstimate: solved.conditionEstimate,
    issues: Object.freeze([]),
    reason: 'Análisis elástico lineal FEM completado.',
  });
};

const sectionTokens = (source: string, name: string): string[] => {
  const match = source.match(new RegExp(`\\$${name}\\s*([\\s\\S]*?)\\$End${name}`));
  if (!match) throw new Error(`Falta la sección Gmsh $${name}.`);
  return match[1].trim().split(/\s+/).filter(Boolean);
};

/** Importador mínimo pero estricto de bloques Gmsh 4.1 ASCII. */
export const parseGmsh41 = (source: string): FemDocumentV1 => {
  const meshFormat = sectionTokens(source, 'MeshFormat');
  if (meshFormat[0] !== '4.1') throw new Error(`Versión Gmsh no compatible: ${meshFormat[0] ?? 'vacía'}.`);
  if (meshFormat[1] !== '0') throw new Error('Sólo se admite Gmsh 4.1 ASCII.');
  const nodeTokens = sectionTokens(source, 'Nodes');
  let cursor = 0;
  const blockCount = Number(nodeTokens[cursor++]);
  const nodeCount = Number(nodeTokens[cursor++]);
  cursor += 2;
  const nodes: FemNode[] = [];
  for (let block = 0; block < blockCount; block += 1) {
    const entityDim = Number(nodeTokens[cursor++]);
    cursor += 1; // entity tag
    const parametric = Number(nodeTokens[cursor++]);
    const count = Number(nodeTokens[cursor++]);
    const tags = nodeTokens.slice(cursor, cursor + count); cursor += count;
    // En Gmsh 4.1 los valores paramétricos van intercalados por nodo
    // (`x y z <u> <v> <w>`), no agrupados al final del bloque: leer las
    // coordenadas de corrido y saltar el resto después desalineaba el bloque
    // entero y devolvía geometría equivocada en vez de fallar.
    const stride = 3 + (parametric ? entityDim : 0);
    if (!Number.isInteger(stride) || stride < 3) throw new Error('Bloque de nodos Gmsh con dimensión paramétrica no válida.');
    const coordinates = nodeTokens.slice(cursor, cursor + count * stride).map(Number); cursor += count * stride;
    if (coordinates.length !== count * stride) throw new Error('Bloque de nodos Gmsh incompleto.');
    for (let index = 0; index < count; index += 1) {
      nodes.push({ id: tags[index], x: coordinates[index * stride], y: coordinates[index * stride + 1], z: coordinates[index * stride + 2] });
    }
  }
  if (nodes.length !== nodeCount) throw new Error('La cabecera Gmsh no coincide con el número de nodos.');
  const elementTokens = sectionTokens(source, 'Elements');
  cursor = 0;
  const elementBlockCount = Number(elementTokens[cursor++]);
  const elementCount = Number(elementTokens[cursor++]);
  cursor += 2;
  const elements: FemElement[] = [];
  const typeMap: Record<number, { type?: FemElementType; nodes: number }> = {
    1: { nodes: 2 }, // boundary line
    2: { type: 'TRI3', nodes: 3 },
    3: { type: 'QUAD4', nodes: 4 },
    4: { type: 'TET4', nodes: 4 },
    8: { nodes: 3 }, // second-order boundary line
    15: { nodes: 1 }, // point entity
  };
  let recordsRead = 0;
  for (let block = 0; block < elementBlockCount; block += 1) {
    cursor += 2;
    const elementType = Number(elementTokens[cursor++]);
    const count = Number(elementTokens[cursor++]);
    const descriptor = typeMap[elementType];
    if (!descriptor) throw new Error(`Tipo de elemento Gmsh no compatible: ${elementType}.`);
    for (let index = 0; index < count; index += 1) {
      const id = elementTokens[cursor++];
      const nodeIds = elementTokens.slice(cursor, cursor + descriptor.nodes); cursor += descriptor.nodes;
      if (nodeIds.length !== descriptor.nodes) throw new Error(`Registro Gmsh incompleto para el elemento ${id ?? '(sin id)'}.`);
      if (descriptor.type) elements.push({ id, type: descriptor.type, nodeIds });
    }
    recordsRead += count;
  }
  if (recordsRead !== elementCount) throw new Error('La cabecera Gmsh no coincide con el número de elementos.');
  return {
    kind: 'fem-document', schemaVersion: 1, id: 'gmsh-import', name: 'Gmsh 4.1', analysis: 'plane-stress',
    material: { id: 'imported-material', E: 1, nu: 0.3, thickness: 1 }, nodes, elements, loads: [], restraints: [],
  };
};

/** Open, dependency-free FEM interchange payload for local files and snapshots. */
export const serializeFemBundle = (document: FemDocumentV1, analysis?: FemAnalysisResult): string => {
  const payload = { format: 'fstructure-fem-bundle', formatVersion: 1, document, ...(analysis ? { analysis } : {}) } satisfies FemOpenBundleV1;
  return JSON.stringify(payload, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? null : value, 2);
};

const vtkCellType: Record<FemElementType, number> = { TRI3: 5, QUAD4: 9, MITC4: 9, TET4: 10 };

/** Legacy ASCII VTK export; unsupported physics can still be inspected geometrically. */
export const exportFemVtk = (document: FemDocumentV1, analysis?: FemAnalysisResult): string => {
  const nodeIndex = new Map(document.nodes.map((node, index) => [node.id, index]));
  const expectedNodeCount: Record<FemElementType, number> = { TRI3: 3, QUAD4: 4, MITC4: 4, TET4: 4 };
  const cells = document.elements.map((element) => {
    if (element.nodeIds.length !== expectedNodeCount[element.type] || element.nodeIds.some((id) => !nodeIndex.has(id))) {
      throw new Error(`No se puede exportar el elemento FEM ${element.id}: conectividad incompleta.`);
    }
    return element.nodeIds.map((id) => nodeIndex.get(id) as number);
  });
  const lines = [
    '# vtk DataFile Version 3.0',
    `FStructure FEM ${document.id}`,
    'ASCII',
    'DATASET UNSTRUCTURED_GRID',
    `POINTS ${document.nodes.length} float`,
    ...document.nodes.map((node) => `${node.x} ${node.y} ${node.z ?? 0}`),
    `CELLS ${cells.length} ${cells.reduce((sum, cell) => sum + cell.length + 1, 0)}`,
    ...cells.map((cell) => `${cell.length} ${cell.join(' ')}`),
    `CELL_TYPES ${cells.length}`,
    ...document.elements.map((element) => String(vtkCellType[element.type])),
  ];
  if (analysis?.success) {
    const displacements = new Map(analysis.displacements.map((item) => [item.nodeId, item]));
    const stresses = new Map(analysis.stresses.map((item) => [item.elementId, item]));
    lines.push('POINT_DATA', String(document.nodes.length), 'VECTORS displacement float', ...document.nodes.map((node) => {
      const value = displacements.get(node.id); return `${value?.ux ?? 0} ${value?.uy ?? 0} ${value?.uz ?? 0}`;
    }), 'CELL_DATA', String(document.elements.length), 'SCALARS vonMises float 1', 'LOOKUP_TABLE default', ...document.elements.map((element) => String(stresses.get(element.id)?.vonMises ?? 0)));
  }
  return `${lines.join('\n')}\n`;
};
