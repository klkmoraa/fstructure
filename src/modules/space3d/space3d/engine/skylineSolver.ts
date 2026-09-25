/**
 * Solver disperso en perfil (skyline) para la rigidez de un marco espacial.
 *
 * Una estructura de barras tiene la rigidez concentrada cerca de la diagonal
 * si los nudos se numeran con Cuthill–McKee inverso: en un edificio el ancho
 * de banda es del orden de los nudos de una planta. Guardar sólo el perfil
 * del triángulo inferior y factorizar `L·D·Lᵀ` in situ (Crout, como COLSOL de
 * Bathe) cuesta `n·b²` operaciones y `n·b` memoria, frente a `n³` y `n²` de
 * la versión densa. Es lo que permite modelos del tamaño de un edificio.
 *
 * Sin pivoteo: la rigidez restringida es simétrica definida positiva. Un
 * pivote nulo o negativo es un mecanismo y se informa con su posición.
 */

export interface Space3DSkylineMatrix {
  readonly n: number;
  /** Primera columna almacenada de cada fila. */
  readonly start: Int32Array;
  /** Posición en `values` del primer término de cada fila; `offset[n]` es el total. */
  readonly offset: Int32Array;
  readonly values: Float64Array;
}

export class Space3DSingularMatrixError extends Error {
  /** Fila (en la numeración del perfil) donde el pivote se anuló. */
  readonly row: number;

  constructor(row: number) {
    super(`singular:${row}`);
    this.name = 'Space3DSingularMatrixError';
    this.row = row;
  }
}

/** Reserva el perfil a partir de la primera columna no nula de cada fila. */
export const createSkylineMatrix = (firstColumn: ArrayLike<number>): Space3DSkylineMatrix => {
  const n = firstColumn.length;
  const start = new Int32Array(n);
  const offset = new Int32Array(n + 1);
  for (let row = 0; row < n; row += 1) {
    const first = Math.max(0, Math.min(row, firstColumn[row]));
    start[row] = first;
    offset[row + 1] = offset[row] + (row - first + 1);
  }
  return { n, start, offset, values: new Float64Array(offset[n]) };
};

/** Suma en `(row, column)` del triángulo inferior; fuera del perfil es un error de programación. */
export const addToSkyline = (matrix: Space3DSkylineMatrix, row: number, column: number, value: number): void => {
  const [i, j] = row >= column ? [row, column] : [column, row];
  const first = matrix.start[i];
  if (j < first) throw new RangeError(`skyline: (${i}, ${j}) fuera del perfil`);
  matrix.values[matrix.offset[i] + (j - first)] += value;
};

/** Norma infinito (= norma 1, por simetría) de la matriz antes de factorizar. */
export const skylineInfinityNorm = (matrix: Space3DSkylineMatrix): number => {
  const sums = new Float64Array(matrix.n);
  for (let i = 0; i < matrix.n; i += 1) {
    const first = matrix.start[i];
    const base = matrix.offset[i];
    for (let j = first; j <= i; j += 1) {
      const value = Math.abs(matrix.values[base + (j - first)]);
      sums[i] += value;
      if (j !== i) sums[j] += value;
    }
  }
  let norm = 0;
  for (let i = 0; i < matrix.n; i += 1) norm = Math.max(norm, sums[i]);
  return norm;
};

export interface Space3DSkylineFactorization {
  readonly n: number;
  readonly minPivot: number;
  readonly maxPivot: number;
  solve(rhs: ArrayLike<number>): Float64Array;
}

/**
 * Factoriza en su sitio (`values` pasa a guardar `L`). Un pivote que no supera
 * `1e-12` veces su término diagonal original es un mecanismo.
 */
export const factorizeSkyline = (matrix: Space3DSkylineMatrix): Space3DSkylineFactorization => {
  const { n, start, offset, values } = matrix;
  const diagonal = new Float64Array(n);
  let minPivot = Number.POSITIVE_INFINITY;
  let maxPivot = 0;

  for (let i = 0; i < n; i += 1) {
    const fi = start[i];
    const oi = offset[i];
    // g_ij = K_ij − Σ L_jr · g_ir, con la fila i todavía sin dividir.
    for (let j = fi; j < i; j += 1) {
      const fj = start[j];
      const oj = offset[j];
      const from = fi > fj ? fi : fj;
      let sum = values[oi + (j - fi)];
      for (let r = from; r < j; r += 1) sum -= values[oj + (r - fj)] * values[oi + (r - fi)];
      values[oi + (j - fi)] = sum;
    }
    const original = values[oi + (i - fi)];
    let pivot = original;
    for (let j = fi; j < i; j += 1) {
      const g = values[oi + (j - fi)];
      const l = g / diagonal[j];
      pivot -= l * g;
      values[oi + (j - fi)] = l;
    }
    if (!(pivot > Math.abs(original) * 1e-12) || !Number.isFinite(pivot)) throw new Space3DSingularMatrixError(i);
    diagonal[i] = pivot;
    values[oi + (i - fi)] = 1;
    if (pivot < minPivot) minPivot = pivot;
    if (pivot > maxPivot) maxPivot = pivot;
  }

  const solve = (rhs: ArrayLike<number>): Float64Array => {
    const x = Float64Array.from(rhs);
    for (let i = 0; i < n; i += 1) {
      const fi = start[i];
      const oi = offset[i];
      let sum = x[i];
      for (let j = fi; j < i; j += 1) sum -= values[oi + (j - fi)] * x[j];
      x[i] = sum;
    }
    for (let i = 0; i < n; i += 1) x[i] /= diagonal[i];
    for (let i = n - 1; i >= 0; i -= 1) {
      const fi = start[i];
      const oi = offset[i];
      const xi = x[i];
      if (xi === 0) continue;
      for (let j = fi; j < i; j += 1) x[j] -= values[oi + (j - fi)] * xi;
    }
    return x;
  };

  return { n, minPivot, maxPivot, solve };
};

/**
 * Cuenta de Sturm: cuántos pivotes de `L·D·Lᵀ` son negativos. Para `K − σ·M`
 * es el número de autovalores de `K·φ = λ·M·φ` por debajo de σ (ley de
 * inercia de Sylvester), que es como se comprueba que un cálculo modal no se
 * saltó ningún modo. Destruye la matriz; devuelve `null` si un pivote es casi
 * nulo (σ cae justo en un autovalor) para que el llamador desplace σ.
 */
export const countSkylineNegativePivots = (matrix: Space3DSkylineMatrix): number | null => {
  const { n, start, offset, values } = matrix;
  const diagonal = new Float64Array(n);
  let negatives = 0;
  for (let i = 0; i < n; i += 1) {
    const fi = start[i];
    const oi = offset[i];
    for (let j = fi; j < i; j += 1) {
      const fj = start[j];
      const oj = offset[j];
      const from = fi > fj ? fi : fj;
      let sum = values[oi + (j - fi)];
      for (let r = from; r < j; r += 1) sum -= values[oj + (r - fj)] * values[oi + (r - fi)];
      values[oi + (j - fi)] = sum;
    }
    const original = values[oi + (i - fi)];
    let pivot = original;
    for (let j = fi; j < i; j += 1) {
      const g = values[oi + (j - fi)];
      const l = g / diagonal[j];
      pivot -= l * g;
      values[oi + (j - fi)] = l;
    }
    if (!Number.isFinite(pivot) || Math.abs(pivot) <= Math.abs(original) * 1e-13) return null;
    diagonal[i] = pivot;
    values[oi + (i - fi)] = 1;
    if (pivot < 0) negatives += 1;
  }
  return negatives;
};

/** `y = A·x` con la matriz sin factorizar (simétrica, sólo el triángulo inferior guardado). */
export const multiplySkyline = (matrix: Space3DSkylineMatrix, x: ArrayLike<number>): Float64Array => {
  const { n, start, offset, values } = matrix;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const fi = start[i];
    const oi = offset[i];
    let sum = 0;
    const xi = x[i];
    for (let j = fi; j < i; j += 1) {
      const value = values[oi + (j - fi)];
      sum += value * x[j];
      y[j] += value * xi;
    }
    y[i] += sum + values[oi + (i - fi)] * xi;
  }
  return y;
};

/** Copia independiente del perfil (la factorización destruye el original). */
export const cloneSkyline = (matrix: Space3DSkylineMatrix): Space3DSkylineMatrix => ({
  n: matrix.n, start: matrix.start, offset: matrix.offset, values: Float64Array.from(matrix.values),
});

/**
 * Cuthill–McKee inverso sobre un grafo dado por listas de adyacencia. Cada
 * componente conexa arranca en un nudo pseudoperiférico (el más lejano de uno
 * de grado mínimo), que es lo que mantiene estrecho el perfil.
 */
export const reverseCuthillMcKeeOrder = (adjacency: readonly (readonly number[])[]): number[] => {
  const n = adjacency.length;
  const visited = new Uint8Array(n);
  const degree = adjacency.map((neighbours) => neighbours.length);
  const order: number[] = [];
  const bfsFarthest = (root: number): number => {
    const seen = new Uint8Array(n);
    let frontier = [root];
    seen[root] = 1;
    let last = root;
    while (frontier.length > 0) {
      const next: number[] = [];
      for (const vertex of frontier) {
        for (const neighbour of adjacency[vertex]) {
          if (seen[neighbour]) continue;
          seen[neighbour] = 1;
          next.push(neighbour);
        }
      }
      if (next.length > 0) last = next.reduce((best, vertex) => (degree[vertex] < degree[best] ? vertex : best), next[0]);
      frontier = next;
    }
    return last;
  };

  const byDegree = Array.from({ length: n }, (_, index) => index).sort((a, b) => degree[a] - degree[b] || a - b);
  for (const candidate of byDegree) {
    if (visited[candidate]) continue;
    const root = bfsFarthest(bfsFarthest(candidate));
    const queue = [root];
    visited[root] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const vertex = queue[head];
      order.push(vertex);
      const neighbours = adjacency[vertex].filter((neighbour) => !visited[neighbour]).sort((a, b) => degree[a] - degree[b] || a - b);
      for (const neighbour of neighbours) {
        visited[neighbour] = 1;
        queue.push(neighbour);
      }
    }
  }
  return order.reverse();
};
