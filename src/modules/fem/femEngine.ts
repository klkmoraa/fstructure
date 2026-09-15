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
  readonly code: 'invalid-value' | 'duplicate-id' | 'missing-reference' | 'unsupported-element' | 'unsupported-analysis' | 'unsupported-load' | 'degenerate-element' | 'empty-model';
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
  readonly normalized: number;
}

export interface FemAnalysisResult {
  readonly success: boolean;
  readonly documentId: string;
  readonly displacements: readonly FemDisplacement[];
  readonly reactions: readonly FemDisplacement[];
  readonly stresses: readonly FemStressResult[];
  readonly meshQuality: FemMeshQuality;
  readonly equilibrium: FemEquilibriumAudit;
  readonly relativeResidual: number;
  readonly conditionEstimate: number;
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
  if (!(Math.abs(detJ) > 1e-14)) return null;
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

const quadAreaAndAspect = (nodes: readonly FemNode[]): { area: number; aspectRatio: number } => {
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
  if (!document || !document.nodes?.length || !document.elements?.length) issues.push(issue('empty-model', 'document', document?.id ?? '', 'elements'));
  if (!document || !['plane-stress', 'plane-strain'].includes(document.analysis)) issues.push(issue('unsupported-analysis', 'document', document?.id ?? '', 'analysis'));
  if (!document?.material || !finite(document.material.E) || document.material.E <= 0) issues.push(issue('invalid-value', 'document', document?.id ?? '', 'material.E'));
  if (!document?.material || !finite(document.material.nu) || document.material.nu <= -1 || document.material.nu >= 0.5) issues.push(issue('invalid-value', 'document', document?.id ?? '', 'material.nu'));
  const nodes = new Set<string>();
  for (const node of document?.nodes ?? []) {
    if (nodes.has(node.id)) issues.push(issue('duplicate-id', 'node', node.id, 'id'));
    nodes.add(node.id);
    if (!node.id || !finite(node.x) || !finite(node.y) || (node.z !== undefined && !finite(node.z))) issues.push(issue('invalid-value', 'node', node.id ?? '', 'coordinate'));
  }
  const elements = new Set<string>();
  for (const element of document?.elements ?? []) {
    if (elements.has(element.id)) issues.push(issue('duplicate-id', 'element', element.id, 'id'));
    elements.add(element.id);
    if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) issues.push(issue('unsupported-element', 'element', element.id, 'type'));
    const expected = element.type === 'TRI3' ? TRI3_NODE_COUNT : element.type === 'QUAD4' ? QUAD4_NODE_COUNT : 0;
    if (expected > 0 && element.nodeIds.length !== expected) issues.push(issue('invalid-value', 'element', element.id, 'nodeIds'));
    if (element.nodeIds.some((id) => !nodes.has(id))) issues.push(issue('missing-reference', 'element', element.id, 'nodeIds'));
  }
  const loadIds = new Set<string>();
  for (const load of document?.loads ?? []) {
    if (loadIds.has(load.id)) issues.push(issue('duplicate-id', 'load', load.id, 'id'));
    loadIds.add(load.id);
    if (!nodes.has(load.nodeId)) issues.push(issue('missing-reference', 'load', load.id, 'nodeId'));
    if (!finite(load.fx) || !finite(load.fy) || (load.fz !== undefined && !finite(load.fz))) issues.push(issue('invalid-value', 'load', load.id, 'components'));
    if ((load.fz ?? 0) !== 0) issues.push(issue('unsupported-load', 'load', load.id, 'fz'));
  }
  for (const restraint of document?.restraints ?? []) {
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

const emptyResult = (documentId: string, issues: readonly FemValidationIssue[], reason: string): FemAnalysisResult => Object.freeze({
  success: false, documentId, displacements: Object.freeze([]), reactions: Object.freeze([]), stresses: Object.freeze([]),
  meshQuality: Object.freeze({ valid: false, minArea: 0, maxAspectRatio: 0, degenerateElementIds: Object.freeze([]) }),
  equilibrium: Object.freeze({ force: Object.freeze([0, 0, 0] as readonly [number, number, number]), normalized: Number.NaN }),
  relativeResidual: Number.NaN, conditionEstimate: Number.NaN, issues: Object.freeze([...issues]), reason,
});

const principalAndVonMises = (sx: number, sy: number, txy: number): { principal: readonly [number, number]; vonMises: number } => {
  const center = (sx + sy) / 2;
  const radius = Math.hypot((sx - sy) / 2, txy);
  return { principal: [center + radius, center - radius], vonMises: Math.sqrt(sx * sx - sx * sy + sy * sy + 3 * txy * txy) };
};

export const analyzeFemDocument = (document: FemDocumentV1): FemAnalysisResult => {
  const issues = validateFemDocument(document);
  if (issues.length > 0) return emptyResult(document?.id ?? '', issues, 'El documento FEM no es admisible.');
  const nodesById = nodeMap(document);
  const material = document.material;
  const thickness = material.thickness ?? 1;
  const D = constitutiveMatrix(material, document.analysis);
  const nodeIndex = new Map(document.nodes.map((node, index) => [node.id, index]));
  const ndof = document.nodes.length * 2;
  const K = zeros(ndof, ndof);
  const elementData: Array<{ element: FemElement; nodes: FemNode[]; B: Matrix; weight: number; area: number; aspectRatio: number }> = [];
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
      elementData.push({ element, nodes: elementNodes, B: geometry.B, weight: geometry.area, area: geometry.area, aspectRatio: geometry.aspectRatio });
      minArea = Math.min(minArea, geometry.area); maxAspectRatio = Math.max(maxAspectRatio, geometry.aspectRatio);
    } else if (element.type === 'QUAD4') {
      const local = zeros(8, 8);
      const gauss = 1 / Math.sqrt(3);
      let centerB: Matrix | null = null;
      let area = 0;
      for (const xi of [-gauss, gauss]) for (const eta of [-gauss, gauss]) {
        const point = quadPoint(elementNodes, xi, eta);
        if (!point) continue;
        addElementMatrix(local, multiplyBDB(point.B, D, thickness, Math.abs(point.detJ)), Array.from({ length: 8 }, (_, index) => index));
        centerB = centerB ?? point.B;
        area += Math.abs(point.detJ);
      }
      const quality = quadAreaAndAspect(elementNodes);
      if (!(area > 0) || !centerB) { degenerateElementIds.push(element.id); continue; }
      addElementMatrix(K, local, elementNodes.flatMap((node) => { const base = nodeIndex.get(node.id)! * 2; return [base, base + 1]; }));
      elementData.push({ element, nodes: elementNodes, B: centerB, weight: thickness, area: quality.area, aspectRatio: quality.aspectRatio });
      minArea = Math.min(minArea, quality.area); maxAspectRatio = Math.max(maxAspectRatio, quality.aspectRatio);
    }
  }
  if (degenerateElementIds.length > 0) return emptyResult(document.id, degenerateElementIds.map((id) => issue('degenerate-element', 'element', id, 'geometry')), 'La malla contiene elementos degenerados.');
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
  if (!free.length) return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'restraints')], 'No quedan grados de libertad libres.');
  let solved: ReturnType<typeof solveLinearSystem>;
  try {
    solved = solveLinearSystem(submatrix(K, free, free), free.map((index) => F[index]));
  } catch (error) {
    return emptyResult(document.id, [issue('invalid-value', 'document', document.id, 'stiffness')], error instanceof Error ? error.message : 'La rigidez FEM es singular.');
  }
  const U = Array.from({ length: ndof }, () => 0);
  free.forEach((global, index) => { U[global] = solved.x[index]; });
  const reactionsVector = multiplyMatrixVector(K, U).map((value, index) => restrained.has(index) ? value - F[index] : 0);
  const displacements = document.nodes.map((node, index) => Object.freeze({ nodeId: node.id, ux: U[index * 2], uy: U[index * 2 + 1], uz: 0 }));
  const reactions = document.nodes.map((node, index) => Object.freeze({ nodeId: node.id, ux: reactionsVector[index * 2], uy: reactionsVector[index * 2 + 1], uz: 0 }));
  const stresses = elementData.map(({ element, nodes: elementNodes, B }) => {
    const localU = elementNodes.flatMap((node) => { const base = nodeIndex.get(node.id)! * 2; return [U[base], U[base + 1]]; });
    const strainVector = multiplyMatrixVector(B, localU);
    const stressVector = multiplyMatrixVector(D, strainVector);
    const invariants = principalAndVonMises(stressVector[0], stressVector[1], stressVector[2]);
    return Object.freeze({ elementId: element.id, type: element.type, strain: [strainVector[0], strainVector[1], strainVector[2]] as const, stress: [stressVector[0], stressVector[1], stressVector[2]] as const, principal: invariants.principal, vonMises: invariants.vonMises });
  });
  let fx = 0; let fy = 0; let fz = 0; let scale = 1;
  for (const load of document.loads) { fx += load.fx; fy += load.fy; fz += load.fz ?? 0; scale = Math.max(scale, Math.abs(load.fx), Math.abs(load.fy), Math.abs(load.fz ?? 0)); }
  reactions.forEach((reaction) => { fx += reaction.ux; fy += reaction.uy; fz += reaction.uz; scale = Math.max(scale, Math.abs(reaction.ux), Math.abs(reaction.uy), Math.abs(reaction.uz)); });
  return Object.freeze({
    success: true,
    documentId: document.id,
    displacements: Object.freeze(displacements),
    reactions: Object.freeze(reactions),
    stresses: Object.freeze(stresses),
    meshQuality: Object.freeze({ valid: minArea > 0, minArea: Number.isFinite(minArea) ? minArea : 0, maxAspectRatio, degenerateElementIds: Object.freeze([]) }),
    equilibrium: Object.freeze({ force: Object.freeze([fx, fy, fz] as readonly [number, number, number]), normalized: Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fz)) / scale }),
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
    const coordinates = nodeTokens.slice(cursor, cursor + count * 3).map(Number); cursor += count * 3;
    for (let index = 0; index < count; index += 1) nodes.push({ id: tags[index], x: coordinates[index * 3], y: coordinates[index * 3 + 1], z: coordinates[index * 3 + 2] });
    // Parametric blocks include one extra coordinate per entity dimension.
    if (parametric) cursor += count * entityDim;
  }
  if (nodes.length !== nodeCount) throw new Error('La cabecera Gmsh no coincide con el número de nodos.');
  const elementTokens = sectionTokens(source, 'Elements');
  cursor = 0;
  const elementBlockCount = Number(elementTokens[cursor++]);
  const elementCount = Number(elementTokens[cursor++]);
  cursor += 2;
  const elements: FemElement[] = [];
  const typeMap: Record<number, { type: FemElementType; nodes: number }> = { 2: { type: 'TRI3', nodes: 3 }, 3: { type: 'QUAD4', nodes: 4 }, 4: { type: 'TET4', nodes: 4 }, 118: { type: 'MITC4', nodes: 4 } };
  for (let block = 0; block < elementBlockCount; block += 1) {
    cursor += 2;
    const elementType = Number(elementTokens[cursor++]);
    const count = Number(elementTokens[cursor++]);
    const descriptor = typeMap[elementType];
    if (!descriptor) throw new Error(`Tipo de elemento Gmsh no compatible: ${elementType}.`);
    for (let index = 0; index < count; index += 1) {
      const id = elementTokens[cursor++];
      const nodeIds = elementTokens.slice(cursor, cursor + descriptor.nodes); cursor += descriptor.nodes;
      elements.push({ id, type: descriptor.type, nodeIds });
    }
  }
  if (elements.length !== elementCount) throw new Error('La cabecera Gmsh no coincide con el número de elementos.');
  return {
    kind: 'fem-document', schemaVersion: 1, id: 'gmsh-import', name: 'Gmsh 4.1', analysis: 'plane-stress',
    material: { id: 'imported-material', E: 1, nu: 0.3, thickness: 1 }, nodes, elements, loads: [], restraints: [],
  };
};

/** Open, dependency-free FEM interchange payload for local files and snapshots. */
export const serializeFemBundle = (document: FemDocumentV1, analysis?: FemAnalysisResult): string =>
  JSON.stringify({ format: 'fstructure-fem-bundle', formatVersion: 1, document, ...(analysis ? { analysis } : {}) } satisfies FemOpenBundleV1, null, 2);

const vtkCellType: Record<FemElementType, number> = { TRI3: 5, QUAD4: 9, MITC4: 9, TET4: 10 };

/** Legacy ASCII VTK export; unsupported physics can still be inspected geometrically. */
export const exportFemVtk = (document: FemDocumentV1, analysis?: FemAnalysisResult): string => {
  const nodeIndex = new Map(document.nodes.map((node, index) => [node.id, index]));
  const cells = document.elements.map((element) => element.nodeIds.map((id) => nodeIndex.get(id)).filter((index): index is number => index !== undefined));
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
