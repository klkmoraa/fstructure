/**
 * Autovalores del problema generalizado `K·φ = λ·B·φ` con `K` simétrica
 * definida positiva (factorizada en perfil) y `B` simétrica semidefinida
 * (masa para el modal, rigidez geométrica de compresión para el pandeo).
 *
 * Lanczos con inversión (`A = K⁻¹·B`, autoadjunto en el producto de `B`) y
 * reortogonalización completa, como el «Eigen» de SAP2000 o el de OpenSees:
 * cada paso cuesta una resolución con la factorización ya hecha, y los modos
 * bajos convergen en unas pocas decenas de pasos aunque el modelo tenga miles
 * de GDL. Un Lanczos de un solo vector ve una vez cada autovalor repetido (un
 * edificio simétrico tiene el mismo periodo en X y en Z), así que el resultado
 * se comprueba con la cuenta de Sturm y, si falta algún modo, se vuelve a
 * lanzar ortogonal a los ya hallados hasta que la cuenta cuadra.
 */

export interface Space3DEigenpair {
  readonly value: number;
  /** Autovector reducido normalizado con `φᵀ·B·φ = 1`. */
  readonly vector: Float64Array;
  /** Cota del error relativo del autovalor. */
  readonly bound: number;
}

/** Generador determinista: el mismo modelo da siempre los mismos modos. */
const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
};

const axpy = (target: Float64Array, factor: number, source: ArrayLike<number>): void => {
  for (let i = 0; i < target.length; i += 1) target[i] += factor * source[i];
};

/**
 * Autovalores y autovectores de una tridiagonal simétrica (QL implícito,
 * `tqli`). `d` es la diagonal y `e[i]` el término (i, i+1). Los vectores se
 * devuelven por columnas: `z[k][i]` es la componente `k` del vector `i`.
 */
export const symmetricTridiagonalEigen = (diagonal: readonly number[], offDiagonal: readonly number[]): { values: Float64Array; vectors: Float64Array[] } => {
  const n = diagonal.length;
  const d = Float64Array.from(diagonal);
  const e = new Float64Array(n);
  for (let i = 0; i < n - 1; i += 1) e[i] = offDiagonal[i];
  const z = Array.from({ length: n }, (_, row) => { const line = new Float64Array(n); line[row] = 1; return line; });
  for (let l = 0; l < n; l += 1) {
    let iterations = 0;
    let m: number;
    do {
      for (m = l; m < n - 1; m += 1) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) <= Number.EPSILON * dd) break;
      }
      if (m !== l) {
        if (iterations++ === 60) throw new Error('tqli: sin convergencia');
        let g = (d[l + 1] - d[l]) / (2 * e[l]);
        let r = Math.hypot(g, 1);
        g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1;
        let c = 1;
        let p = 0;
        let i: number;
        let underflow = false;
        for (i = m - 1; i >= l; i -= 1) {
          const f = s * e[i];
          const b = c * e[i];
          r = Math.hypot(f, g);
          e[i + 1] = r;
          if (r === 0) {
            d[i + 1] -= p;
            e[m] = 0;
            underflow = true;
            break;
          }
          s = f / r;
          c = g / r;
          g = d[i + 1] - p;
          r = (d[i] - g) * s + 2 * c * b;
          p = s * r;
          d[i + 1] = g + p;
          g = c * r - b;
          for (let k = 0; k < n; k += 1) {
            const zf = z[k][i + 1];
            z[k][i + 1] = s * z[k][i] + c * zf;
            z[k][i] = c * z[k][i] - s * zf;
          }
        }
        if (underflow && i >= l) continue;
        d[l] -= p;
        e[l] = g;
        e[m] = 0;
      }
    } while (m !== l);
  }
  const vectors = Array.from({ length: n }, (_, column) => {
    const vector = new Float64Array(n);
    for (let k = 0; k < n; k += 1) vector[k] = z[k][column];
    return vector;
  });
  return { values: d, vectors };
};

interface LanczosInput {
  readonly n: number;
  /** `K⁻¹·r` con la factorización hecha. */
  readonly solve: (rhs: Float64Array) => Float64Array;
  /** `B·v`. */
  readonly applyB: (vector: Float64Array) => Float64Array;
  /** Cuántos modos se buscan. */
  readonly count: number;
  /** Pares ya hallados: la búsqueda se hace en su complemento `B`-ortogonal. */
  readonly locked?: readonly Space3DEigenpair[];
  readonly maxSteps: number;
  readonly tolerance: number;
  readonly seed: number;
}

interface LanczosOutput {
  readonly pairs: readonly Space3DEigenpair[];
  readonly steps: number;
  /** El subespacio de Krylov se agotó: todos los pares hallados son exactos. */
  readonly exhausted: boolean;
}

/** Lanczos con inversión y reortogonalización completa en el producto de `B`. */
export const lanczosEigenpairs = (input: LanczosInput): LanczosOutput => {
  const { n, solve, applyB, count, tolerance } = input;
  const locked = input.locked ?? [];
  const lockedB = locked.map((pair) => applyB(pair.vector));
  const random = mulberry32(input.seed);
  const purify = (vector: Float64Array) => {
    // Quita lo ya hallado: φᵢᵀ·B·r = (B·φᵢ)ᵀ·r.
    for (let pass = 0; pass < 2; pass += 1) {
      locked.forEach((pair, index) => axpy(vector, -dot(lockedB[index], vector), pair.vector));
    }
  };

  const start = new Float64Array(n);
  for (let i = 0; i < n; i += 1) start[i] = random() * 2 - 1;
  // K⁻¹·B·r0 cae en la imagen del operador: sin componentes de masa nula.
  let r = solve(applyB(start));
  purify(r);
  let p = applyB(r);
  let beta = Math.sqrt(Math.max(0, dot(r, p)));
  const Q: Float64Array[] = [];
  const P: Float64Array[] = [];
  const alphas: number[] = [];
  const betas: number[] = [];
  if (!(beta > 0) || !Number.isFinite(beta)) return { pairs: [], steps: 0, exhausted: true };
  let scale = 0;

  const ritz = (size: number, lastBeta: number): Space3DEigenpair[] => {
    const { values, vectors } = symmetricTridiagonalEigen(alphas.slice(0, size), betas.slice(0, size - 1));
    const order = Array.from({ length: size }, (_, index) => index).sort((a, b) => values[b] - values[a]);
    const pairs: Space3DEigenpair[] = [];
    for (const index of order) {
      const theta = values[index];
      if (!(theta > 0)) break;
      const s = vectors[index];
      const bound = Math.abs(lastBeta * s[size - 1]) / theta;
      const vector = new Float64Array(n);
      for (let k = 0; k < size; k += 1) axpy(vector, s[k], Q[k]);
      pairs.push({ value: 1 / theta, vector, bound });
      if (pairs.length >= count) break;
    }
    return pairs;
  };

  const maxSteps = Math.max(1, Math.min(input.maxSteps, n));
  for (let step = 0; step < maxSteps; step += 1) {
    const q = r.map((value) => value / beta);
    const pq = p.map((value) => value / beta);
    Q.push(q);
    P.push(pq);
    const w = solve(pq);
    if (step > 0) axpy(w, -betas[step - 1], Q[step - 1]);
    const alpha = dot(w, pq);
    axpy(w, -alpha, q);
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i <= step; i += 1) axpy(w, -dot(P[i], w), Q[i]);
    }
    purify(w);
    alphas.push(alpha);
    scale = Math.max(scale, Math.abs(alpha));
    const pw = applyB(w);
    const nextBeta = Math.sqrt(Math.max(0, dot(w, pw)));
    const size = step + 1;
    // Subespacio agotado (el rango de B es pequeño): los pares son exactos.
    if (!(nextBeta > scale * 1e-12) || !Number.isFinite(nextBeta)) {
      return { pairs: ritz(size, 0), steps: size, exhausted: true };
    }
    const check = size >= count && (size % 4 === 0 || size === maxSteps);
    if (check) {
      const pairs = ritz(size, nextBeta);
      if (pairs.length >= count && pairs.slice(0, count).every((pair) => pair.bound <= tolerance)) {
        return { pairs, steps: size, exhausted: false };
      }
      if (size === maxSteps) return { pairs: pairs.filter((pair) => pair.bound <= tolerance), steps: size, exhausted: false };
    }
    betas.push(nextBeta);
    r = w;
    p = pw;
    beta = nextBeta;
  }
  const pairs = ritz(alphas.length, beta);
  return { pairs: pairs.filter((pair) => pair.bound <= tolerance), steps: alphas.length, exhausted: false };
};

interface GeneralizedEigenInput {
  readonly n: number;
  readonly solve: (rhs: Float64Array) => Float64Array;
  readonly applyB: (vector: Float64Array) => Float64Array;
  readonly count: number;
  /** Número de autovalores de `K − σ·B` por debajo de σ; `null` si σ cae en uno. */
  readonly sturmCount: (sigma: number) => number | null;
  readonly tolerance?: number;
}

export interface Space3DGeneralizedEigenResult {
  readonly pairs: readonly Space3DEigenpair[];
  readonly converged: boolean;
  /** La cuenta de Sturm confirma que no falta ningún modo por debajo del último. */
  readonly sturmVerified: boolean;
  readonly steps: number;
}

/**
 * Los `count` autovalores más bajos, comprobados con Sturm. Si la cuenta dice
 * que faltan modos (repetidos), se relanza Lanczos en el complemento de los
 * hallados, con otra semilla, hasta que la cuenta cuadra.
 */
export const smallestGeneralizedEigenpairs = (input: GeneralizedEigenInput): Space3DGeneralizedEigenResult => {
  const tolerance = input.tolerance ?? 1e-9;
  const maxSteps = Math.min(input.n, Math.max(3 * input.count + 30, 60));
  let found: Space3DEigenpair[] = [];
  let steps = 0;
  // Cada relanzamiento halla al menos una copia más de cada autovalor
  // repetido; con `count` intentos cabe la peor multiplicidad pedida.
  const attempts = Math.min(input.count, 16) + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const run = lanczosEigenpairs({
      n: input.n,
      solve: input.solve,
      applyB: input.applyB,
      count: input.count,
      locked: found,
      maxSteps,
      tolerance,
      seed: 0x5eed + attempt * 7919,
    });
    steps += run.steps;
    found = [...found, ...run.pairs].sort((a, b) => a.value - b.value);
    const wanted = found.slice(0, input.count);
    if (wanted.length === 0) return { pairs: [], converged: false, sturmVerified: false, steps };
    const complete = wanted.length === input.count || run.exhausted;
    const top = wanted[wanted.length - 1].value;
    let below: number | null = null;
    let sigma = top;
    for (let shift = 1e-6; shift < 1e-2 && below === null; shift *= 10) {
      sigma = top * (1 + shift);
      below = input.sturmCount(sigma);
    }
    if (below === null) return { pairs: wanted, converged: complete, sturmVerified: false, steps };
    const listed = found.filter((pair) => pair.value < sigma).length;
    // La cuenta cuadra: no hay modos escondidos debajo del último pedido.
    if (below === listed && complete) return { pairs: wanted, converged: true, sturmVerified: true, steps };
    if (below < listed || run.pairs.length === 0) return { pairs: wanted, converged: complete, sturmVerified: false, steps };
  }
  const wanted = found.slice(0, input.count);
  return { pairs: wanted, converged: wanted.length === input.count, sturmVerified: false, steps };
};
