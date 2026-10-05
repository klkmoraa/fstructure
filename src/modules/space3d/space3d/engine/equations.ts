/**
 * Numeración de ecuaciones con restricciones maestro-esclavo.
 *
 * Un GDL global puede ser, en el sistema reducido:
 *
 *   · libre: una ecuación propia;
 *   · restringido: ninguna (vale cero);
 *   · esclavo de un diafragma rígido: combinación lineal de las tres
 *     ecuaciones del diafragma `(Ux, Uz, θ)` situadas en su centro
 *     `(cx, cz)`. Con `dx = x − cx`, `dz = z − cz`, un giro θ alrededor de
 *     +Y mueve el punto `θ·ŷ × r = θ·(dz, 0, −dx)`, así que
 *
 *         ux = Ux + θ·dz,   uz = Uz − θ·dx,   ry = θ.
 *
 * Es la transformación `u = C·û` de ETABS/SAP2000 para el «Diaphragm
 * constraint»: la rigidez reducida es `Cᵀ·K·C` y la masa `Cᵀ·M·C`, ambas
 * ensambladas barra a barra sin formar `C`. No hay penalización: las vigas
 * del plano no se acortan exactamente, no casi.
 *
 * Los nudos y los diafragmas se ordenan juntos con Cuthill–McKee inverso: un
 * diafragma es un vértice más del grafo, vecino de sus nudos y de los vecinos
 * de sus nudos, y eso mantiene estrecho el perfil de un edificio.
 */
import type { Matrix } from '../../../../foundation/linearAlgebra';
import { addToSkyline, reverseCuthillMcKeeOrder, type Space3DSkylineMatrix } from './skylineSolver';
import type { Space3DDiaphragm, Space3DNode, Space3DVector } from '../model/types';

const DOF_PER_NODE = 6;
/** GDL del nudo que sigue al diafragma: ux, uz, ry. */
export const SPACE3D_DIAPHRAGM_DOFS = Object.freeze([0, 2, 4] as const);

export interface Space3DSlaveTerms {
  readonly equations: Int32Array;
  readonly coefficients: Float64Array;
}

export interface Space3DDiaphragmEquations {
  readonly id: string;
  readonly name: string;
  readonly nodeIds: readonly string[];
  /** Centro geométrico de sus nudos: donde se miden Ux, Uz y θ. */
  readonly center: Space3DVector;
  /** Ecuaciones de Ux, Uz y θ. */
  readonly equations: readonly [number, number, number];
}

/** Qué representa una ecuación: el GDL de un nudo o el de un diafragma. */
export type Space3DEquationOwner =
  | { readonly kind: 'node'; readonly nodeIndex: number; readonly dof: number }
  | { readonly kind: 'diaphragm'; readonly diaphragmIndex: number; readonly component: 0 | 1 | 2 };

export interface Space3DEquationMap {
  readonly count: number;
  readonly firstColumn: Int32Array;
  /** Ecuación directa de cada GDL global, o −1 si está restringido o es esclavo. */
  readonly position: Int32Array;
  readonly slaves: ReadonlyMap<number, Space3DSlaveTerms>;
  readonly diaphragms: readonly Space3DDiaphragmEquations[];
  readonly owners: readonly Space3DEquationOwner[];
}

/** Índice del diafragma de cada nudo (−1 si no pertenece a ninguno). */
export const space3DDiaphragmOfNodes = (
  nodes: readonly Space3DNode[],
  diaphragms: readonly Space3DDiaphragm[],
): Int32Array => {
  const index = new Map(nodes.map((node, position) => [node.id, position]));
  const owner = new Int32Array(nodes.length).fill(-1);
  diaphragms.forEach((diaphragm, diaphragmIndex) => {
    for (const nodeId of diaphragm.nodeIds) {
      const position = index.get(nodeId);
      if (position !== undefined) owner[position] = diaphragmIndex;
    }
  });
  return owner;
};

/** GDL globales esclavos de un diafragma. */
export const space3DSlaveDofs = (diaphragmOf: Int32Array): Set<number> => {
  const slaves = new Set<number>();
  diaphragmOf.forEach((diaphragm, node) => {
    if (diaphragm < 0) return;
    for (const dof of SPACE3D_DIAPHRAGM_DOFS) slaves.add(node * DOF_PER_NODE + dof);
  });
  return slaves;
};

/**
 * Numera las ecuaciones: nudos y diafragmas ordenados con RCM, los GDL libres
 * de cada vértice seguidos y la primera columna de cada fila tomada de sus
 * vecinos en el grafo.
 */
export const planSpace3DEquations = (input: {
  readonly nodes: readonly Space3DNode[];
  readonly connections: readonly (readonly [number, number])[];
  readonly diaphragms: readonly Space3DDiaphragm[];
  readonly diaphragmOf: Int32Array;
  readonly restrained: ReadonlySet<number>;
}): Space3DEquationMap => {
  const { nodes, connections, diaphragms, diaphragmOf, restrained } = input;
  const nodeCount = nodes.length;
  const vertexCount = nodeCount + diaphragms.length;
  const neighbours: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>());
  const link = (a: number, b: number) => { if (a !== b) { neighbours[a].add(b); neighbours[b].add(a); } };
  for (const [i, j] of connections) {
    const vertices = [i, j];
    if (diaphragmOf[i] >= 0) vertices.push(nodeCount + diaphragmOf[i]);
    if (diaphragmOf[j] >= 0) vertices.push(nodeCount + diaphragmOf[j]);
    for (let a = 0; a < vertices.length; a += 1) for (let b = a + 1; b < vertices.length; b += 1) link(vertices[a], vertices[b]);
  }
  diaphragmOf.forEach((diaphragm, node) => { if (diaphragm >= 0) link(node, nodeCount + diaphragm); });

  const order = reverseCuthillMcKeeOrder(neighbours.map((set) => [...set]));
  const position = new Int32Array(nodeCount * DOF_PER_NODE).fill(-1);
  const firstOfVertex = new Int32Array(vertexCount).fill(-1);
  const owners: Space3DEquationOwner[] = [];
  const diaphragmEquations: [number, number, number][] = diaphragms.map(() => [-1, -1, -1]);
  const slaveDofs = space3DSlaveDofs(diaphragmOf);
  let next = 0;
  for (const vertex of order) {
    if (vertex < nodeCount) {
      for (let dof = 0; dof < DOF_PER_NODE; dof += 1) {
        const global = vertex * DOF_PER_NODE + dof;
        if (restrained.has(global) || slaveDofs.has(global)) continue;
        if (firstOfVertex[vertex] < 0) firstOfVertex[vertex] = next;
        position[global] = next;
        owners.push({ kind: 'node', nodeIndex: vertex, dof });
        next += 1;
      }
    } else {
      const diaphragmIndex = vertex - nodeCount;
      firstOfVertex[vertex] = next;
      for (const component of [0, 1, 2] as const) {
        diaphragmEquations[diaphragmIndex][component] = next;
        owners.push({ kind: 'diaphragm', diaphragmIndex, component });
        next += 1;
      }
    }
  }

  const firstColumn = new Int32Array(next);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (firstOfVertex[vertex] < 0) continue;
    let first = firstOfVertex[vertex];
    for (const other of neighbours[vertex]) if (firstOfVertex[other] >= 0 && firstOfVertex[other] < first) first = firstOfVertex[other];
    if (vertex < nodeCount) {
      for (let dof = 0; dof < DOF_PER_NODE; dof += 1) {
        const row = position[vertex * DOF_PER_NODE + dof];
        if (row >= 0) firstColumn[row] = first;
      }
    } else {
      for (const row of diaphragmEquations[vertex - nodeCount]) firstColumn[row] = first;
    }
  }

  const diaphragmList: Space3DDiaphragmEquations[] = diaphragms.map((diaphragm, index) => {
    let cx = 0; let cy = 0; let cz = 0; let count = 0;
    diaphragmOf.forEach((owner, node) => {
      if (owner !== index) return;
      cx += nodes[node].x; cy += nodes[node].y; cz += nodes[node].z; count += 1;
    });
    const center: Space3DVector = count > 0 ? [cx / count, cy / count, cz / count] : [0, 0, 0];
    return Object.freeze({ id: diaphragm.id, name: diaphragm.name, nodeIds: diaphragm.nodeIds, center, equations: diaphragmEquations[index] });
  });

  const slaves = new Map<number, Space3DSlaveTerms>();
  diaphragmOf.forEach((diaphragm, node) => {
    if (diaphragm < 0) return;
    const { center, equations: [ux, uz, theta] } = diaphragmList[diaphragm];
    const dx = nodes[node].x - center[0];
    const dz = nodes[node].z - center[2];
    const base = node * DOF_PER_NODE;
    slaves.set(base, { equations: Int32Array.of(ux, theta), coefficients: Float64Array.of(1, dz) });
    slaves.set(base + 2, { equations: Int32Array.of(uz, theta), coefficients: Float64Array.of(1, -dx) });
    slaves.set(base + 4, { equations: Int32Array.of(theta), coefficients: Float64Array.of(1) });
  });

  return Object.freeze({ count: next, firstColumn, position, slaves, diaphragms: Object.freeze(diaphragmList), owners: Object.freeze(owners) });
};

/** `ûᵀ` de un vector global: `Cᵀ·f`. */
export const reduceSpace3DVector = (map: Space3DEquationMap, full: ArrayLike<number>): Float64Array => {
  const reduced = new Float64Array(map.count);
  for (let dof = 0; dof < map.position.length; dof += 1) {
    const value = full[dof] ?? 0;
    if (value === 0) continue;
    const row = map.position[dof];
    if (row >= 0) { reduced[row] += value; continue; }
    const terms = map.slaves.get(dof);
    if (!terms) continue;
    for (let k = 0; k < terms.equations.length; k += 1) reduced[terms.equations[k]] += terms.coefficients[k] * value;
  }
  return reduced;
};

/** Vector global `C·û`; los GDL restringidos valen cero. */
export const expandSpace3DVector = (map: Space3DEquationMap, reduced: ArrayLike<number>): number[] => {
  const full = new Array<number>(map.position.length).fill(0);
  for (let dof = 0; dof < full.length; dof += 1) {
    const row = map.position[dof];
    if (row >= 0) { full[dof] = reduced[row]; continue; }
    const terms = map.slaves.get(dof);
    if (!terms) continue;
    let value = 0;
    for (let k = 0; k < terms.equations.length; k += 1) value += terms.coefficients[k] * reduced[terms.equations[k]];
    full[dof] = value;
  }
  return full;
};

/** Términos (ecuación, coeficiente) de un GDL global. */
const termsOf = (map: Space3DEquationMap, dof: number): { equations: ArrayLike<number>; coefficients: ArrayLike<number> } | null => {
  const row = map.position[dof];
  if (row >= 0) return { equations: [row], coefficients: [1] };
  return map.slaves.get(dof) ?? null;
};

/** Suma `Cᵀ·kₑ·C` de una barra en el perfil. */
export const scatterSpace3DElement = (
  map: Space3DEquationMap,
  matrix: Space3DSkylineMatrix,
  dofIndices: readonly number[],
  stiffness: Matrix,
): void => {
  const terms = dofIndices.map((dof) => termsOf(map, dof));
  for (let a = 0; a < dofIndices.length; a += 1) {
    const ta = terms[a];
    if (!ta) continue;
    const row = stiffness[a];
    for (let b = 0; b < dofIndices.length; b += 1) {
      const tb = terms[b];
      const value = row[b];
      if (!tb || value === 0) continue;
      for (let p = 0; p < ta.equations.length; p += 1) {
        const ea = ta.equations[p];
        const ca = ta.coefficients[p] * value;
        for (let q = 0; q < tb.equations.length; q += 1) {
          const eb = tb.equations[q];
          // Cada par se visita dos veces (a,b) y (b,a): sólo el triángulo inferior.
          if (eb > ea) continue;
          addToSkyline(matrix, ea, eb, ca * tb.coefficients[q]);
        }
      }
    }
  }
};

/** Suma una masa (o rigidez) diagonal global `m` en el GDL `dof`: `Cᵀ·m·C`. */
export const scatterSpace3DDiagonal = (map: Space3DEquationMap, matrix: Space3DSkylineMatrix, dof: number, value: number): void => {
  const terms = termsOf(map, dof);
  if (!terms || value === 0) return;
  for (let p = 0; p < terms.equations.length; p += 1) {
    for (let q = 0; q < terms.equations.length; q += 1) {
      const ea = terms.equations[p];
      const eb = terms.equations[q];
      if (eb > ea) continue;
      addToSkyline(matrix, ea, eb, value * terms.coefficients[p] * terms.coefficients[q]);
    }
  }
};
