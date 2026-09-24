/**
 * Elemento frame espacial de doce grados de libertad (Euler–Bernoulli
 * prismático, sin deformación por cortante ni alabeo).
 *
 * Orden local de GDL: `[u, v, w, rx, ry, rz]` en el nudo `i` y luego los mismos
 * seis en el nudo `j`. `Iz` gobierna la flexión en el plano `x–y` (pareja
 * `v`–`rz`) e `Iy` la del plano `x–z` (pareja `w`–`ry`); esta última cambia de
 * signo porque un giro positivo alrededor de `+y` desplaza `w` en `-z`.
 *
 * Dos variantes más, como en SAP2000/ETABS:
 *
 *   · Liberaciones de extremo: los GDL liberados se condensan estáticamente.
 *     La matriz sigue siendo 12×12, con filas y columnas nulas en lo liberado,
 *     y el elemento guarda lo necesario para condensar sus cargas y recuperar
 *     el desplazamiento propio del extremo liberado (el giro de la rótula).
 *   · Armadura: sólo rigidez axial. No transmite momentos ni torsión.
 */
import { multiply, transpose, zeros, type Matrix } from '../../../../foundation/linearAlgebra';
import { buildMemberOrientation, memberLength } from './orientation';
import type { Space3DFrameMember, Space3DMemberRelease, Space3DNode, Space3DOrientationBasis } from '../model/types';

interface Space3DSectionProperties {
  readonly E: number;
  readonly G: number;
  readonly A: number;
  readonly Iy: number;
  readonly Iz: number;
  readonly J: number;
}

/** Condensación estática de los GDL liberados. */
interface Space3DElementCondensation {
  /** Índices locales liberados, en orden ascendente. */
  readonly released: readonly number[];
  /** `k_cc⁻¹`, |c|×|c|. */
  readonly kccInverse: Matrix;
  /** `k_c·` completa (filas liberadas de la rigidez sin condensar), |c|×12. */
  readonly kcFull: Matrix;
  /** `k_·c` completa (columnas liberadas de la rigidez sin condensar), 12×|c|. */
  readonly kFullC: Matrix;
}

export interface Space3DElement {
  readonly memberId: string;
  readonly kind: 'frame' | 'truss';
  readonly length: number;
  readonly basis: Space3DOrientationBasis;
  /** Rigidez local ya condensada: nulas las filas/columnas liberadas. */
  readonly localStiffness: Matrix;
  readonly transformation: Matrix;
  readonly globalStiffness: Matrix;
  readonly condensation: Space3DElementCondensation | null;
}

/** El orden de las claves reproduce el de los GDL locales. */
const RELEASE_KEYS: readonly (keyof Space3DMemberRelease)[] = [
  'iUx', 'iUy', 'iUz', 'iRx', 'iRy', 'iRz', 'jUx', 'jUy', 'jUz', 'jRx', 'jRy', 'jRz',
];

/** Índices locales liberados; vacío si no hay liberaciones activas. */
export const releasedLocalDofs = (releases: Space3DMemberRelease | undefined): number[] =>
  releases ? RELEASE_KEYS.flatMap((key, index) => (releases[key] ? [index] : [])) : [];

/** Una liberación que deja al elemento como mecanismo: se rechaza con este error. */
export class Space3DReleaseInstabilityError extends Error {
  readonly memberId: string;

  constructor(memberId: string) {
    super(`release-instability:${memberId}`);
    this.name = 'Space3DReleaseInstabilityError';
    this.memberId = memberId;
  }
}

const addSymmetric2 = (k: Matrix, [a, b]: readonly [number, number], diagonal: number, offDiagonal: number) => {
  k[a][a] += diagonal;
  k[b][b] += diagonal;
  k[a][b] += offDiagonal;
  k[b][a] += offDiagonal;
};

/**
 * Bloque de flexión estándar sobre los índices `[traslación_i, giro_i,
 * traslación_j, giro_j]`. `sign` es `+1` para la pareja `v`–`rz` y `-1` para
 * `w`–`ry`.
 */
const addBendingBlock = (
  k: Matrix,
  [a, b, c, d]: readonly [number, number, number, number],
  EI: number,
  L: number,
  sign: 1 | -1,
) => {
  const t = 12 * EI / L ** 3;
  const m = sign * 6 * EI / L ** 2;
  const r4 = 4 * EI / L;
  const r2 = 2 * EI / L;

  k[a][a] += t; k[a][b] += m; k[a][c] += -t; k[a][d] += m;
  k[b][a] += m; k[b][b] += r4; k[b][c] += -m; k[b][d] += r2;
  k[c][a] += -t; k[c][b] += -m; k[c][c] += t; k[c][d] += -m;
  k[d][a] += m; k[d][b] += r2; k[d][c] += -m; k[d][d] += r4;
};

const spaceFrameLocalStiffness = (properties: Space3DSectionProperties, length: number): Matrix => {
  const { E, G, A, Iy, Iz, J } = properties;
  const L = length;
  const k = zeros(12, 12);

  addSymmetric2(k, [0, 6], E * A / L, -(E * A / L));
  addSymmetric2(k, [3, 9], G * J / L, -(G * J / L));
  addBendingBlock(k, [1, 5, 7, 11], E * Iz, L, 1);
  addBendingBlock(k, [2, 4, 8, 10], E * Iy, L, -1);

  return k;
};

const trussLocalStiffness = (properties: Space3DSectionProperties, length: number): Matrix => {
  const k = zeros(12, 12);
  addSymmetric2(k, [0, 6], properties.E * properties.A / length, -(properties.E * properties.A / length));
  return k;
};

/**
 * Inversa de una matriz pequeña por Gauss-Jordan con pivoteo parcial. Devuelve
 * `null` si un pivote cae por debajo de la escala del problema: la liberación
 * pedida deja un mecanismo dentro de la barra.
 */
const invertSmall = (matrix: Matrix): Matrix | null => {
  const n = matrix.length;
  const scale = Math.max(...matrix.flat().map(Math.abs), Number.MIN_VALUE);
  const a = matrix.map((row, index) => [...row, ...Array.from({ length: n }, (_, column) => (column === index ? 1 : 0))]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    if (Math.abs(a[pivot][column]) <= scale * 1e-10) return null;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    for (let entry = 0; entry < 2 * n; entry += 1) a[column][entry] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      if (factor === 0) continue;
      for (let entry = 0; entry < 2 * n; entry += 1) a[row][entry] -= factor * a[column][entry];
    }
  }
  return a.map((row) => row.slice(n));
};

/** `k_rr − k_rc k_cc⁻¹ k_cr` expresada en 12×12 con lo liberado a cero. */
const condense = (memberId: string, k: Matrix, released: readonly number[]): { stiffness: Matrix; condensation: Space3DElementCondensation } => {
  const kcc = released.map((row) => released.map((column) => k[row][column]));
  const kccInverse = invertSmall(kcc);
  if (!kccInverse) throw new Space3DReleaseInstabilityError(memberId);
  const kcFull = released.map((row) => [...k[row]]);
  const kFullC = k.map((row) => released.map((column) => row[column]));
  // correction = k_·c · k_cc⁻¹ · k_c·
  const left = multiply(kFullC, kccInverse);
  const correction = multiply(left, kcFull);
  const stiffness = k.map((row, i) => row.map((value, j) => value - correction[i][j]));
  // Las filas y columnas liberadas ya son nulas en aritmética exacta; se fijan
  // a cero para que el redondeo no deje rigidez fantasma en el nudo.
  for (const index of released) {
    for (let other = 0; other < 12; other += 1) {
      stiffness[index][other] = 0;
      stiffness[other][index] = 0;
    }
  }
  return { stiffness, condensation: { released: [...released], kccInverse, kcFull, kFullC } };
};

/**
 * Matriz de transformación 12×12: cuatro copias del bloque 3×3 cuyas filas son
 * los ejes locales expresados en global, de modo que `uLocal = T · uGlobal`.
 */
const spaceFrameTransformation = (basis: Space3DOrientationBasis): Matrix => {
  const T = zeros(12, 12);
  const rows = [basis.x, basis.y, basis.z];
  for (let block = 0; block < 4; block += 1) {
    const offset = block * 3;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) T[offset + row][offset + col] = rows[row][col];
    }
  }
  return T;
};

export const buildSpaceFrameElement = (
  member: Space3DFrameMember,
  nodeI: Space3DNode,
  nodeJ: Space3DNode,
): Space3DElement => {
  const start = [nodeI.x, nodeI.y, nodeI.z] as const;
  const end = [nodeJ.x, nodeJ.y, nodeJ.z] as const;
  const length = memberLength(start, end);
  const basis = buildMemberOrientation(start, end, member.orientation);
  const kind = member.type === 'truss' ? 'truss' : 'frame';
  const full = kind === 'truss' ? trussLocalStiffness(member, length) : spaceFrameLocalStiffness(member, length);
  const released = kind === 'frame' ? releasedLocalDofs(member.releases) : [];
  const { stiffness: localStiffness, condensation } = released.length > 0
    ? condense(member.id, full, released)
    : { stiffness: full, condensation: null };
  const transformation = spaceFrameTransformation(basis);
  const globalStiffness = multiply(transpose(transformation), multiply(localStiffness, transformation));

  return { memberId: member.id, kind, length, basis, localStiffness, transformation, globalStiffness, condensation };
};

/**
 * Fuerzas de empotramiento condensadas: `f_r − k_rc k_cc⁻¹ f_c`, y cero en lo
 * liberado. Sin liberaciones, la entrada vuelve tal cual.
 */
export const condenseFixedEndForces = (element: Space3DElement, fixedEnd: readonly number[]): number[] => {
  const condensation = element.condensation;
  if (!condensation) return [...fixedEnd];
  const fc = condensation.released.map((index) => fixedEnd[index]);
  const z = condensation.kccInverse.map((row) => row.reduce((sum, value, index) => sum + value * fc[index], 0));
  const result = fixedEnd.map((value, row) => value - condensation.kFullC[row].reduce((sum, coefficient, index) => sum + coefficient * z[index], 0));
  for (const index of condensation.released) result[index] = 0;
  return result;
};

/**
 * Desplazamientos locales del propio extremo de la barra. En lo retenido
 * coinciden con los del nudo; en lo liberado se recuperan con
 * `u_c = −k_cc⁻¹ (k_cr u_r + f_c)`, que es el giro relativo de la rótula.
 */
export const recoverMemberEndDisplacements = (
  element: Space3DElement,
  nodeLocal: readonly number[],
  fixedEnd: readonly number[],
): number[] => {
  const condensation = element.condensation;
  if (!condensation) return [...nodeLocal];
  const releasedSet = new Set(condensation.released);
  const retained = nodeLocal.map((value, index) => (releasedSet.has(index) ? 0 : value));
  const rhs = condensation.kcFull.map((row, index) => row.reduce((sum, value, column) => sum + value * retained[column], 0)
    + fixedEnd[condensation.released[index]]);
  const uc = condensation.kccInverse.map((row) => -row.reduce((sum, value, index) => sum + value * rhs[index], 0));
  const result = [...retained];
  condensation.released.forEach((index, position) => { result[index] = uc[position]; });
  return result;
};
