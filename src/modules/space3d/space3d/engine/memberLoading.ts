/**
 * Cargas sobre barras, peso propio y esfuerzos a lo largo de la barra.
 *
 * Tres piezas puras que comparten convención con `element.ts`:
 *
 *   1. `resolveSpace3DMemberLoads` traduce las cargas del proyecto que tocan a
 *      una barra —cargas en barra y peso propio— a ejes locales, en kN/m de
 *      longitud real y posiciones absolutas desde el extremo `i`.
 *   2. `space3DFixedEndForces` devuelve las fuerzas de empotramiento perfecto
 *      (acciones de los nudos sobre la barra con desplazamientos nulos). Son el
 *      negativo del vector de cargas consistente: funciones de Hermite en
 *      flexión y lineales en axil y torsión. En una armadura la flexión usa
 *      funciones lineales, que equivalen a la barra biarticulada.
 *   3. `computeSpace3DMemberStations` recorre la barra por equilibrio del tramo
 *      `[0, x]` y devuelve N, V, T, M y la elástica local.
 *
 * Convención de esfuerzos internos (la del tramo izquierdo): N positivo a
 * tracción; `Mz` positivo cuando tracciona la fibra de `−y` (flecha positiva
 * de la curvatura `v'' = Mz / E Iz`); `w'' = −My / E Iy`.
 */
import { SPACE3D_MATERIALS } from '../model/sectionLibrary';
import type {
  Space3DFrameMember, Space3DMemberLoad, Space3DMemberStation, Space3DOrientationBasis, Space3DProjectV1, Space3DVector,
} from '../model/types';

/** Aceleración de la gravedad para el peso propio, m/s². */
export const SPACE3D_GRAVITY = 9.80665;

type Vec3 = readonly [number, number, number];

export interface Space3DLocalDistributedLoad {
  /** Inicio y fin absolutos desde `i`, m. */
  readonly a: number;
  readonly b: number;
  /** Intensidad local en `a` y en `b`, kN/m de longitud real. */
  readonly q1: Vec3;
  readonly q2: Vec3;
}

export interface Space3DLocalPointLoad {
  readonly a: number;
  /** Fuerza local, kN. */
  readonly p: Vec3;
}

export interface Space3DLocalMomentLoad {
  readonly a: number;
  /** Momento local, kN·m. */
  readonly m: Vec3;
}

export interface Space3DLocalLoadSet {
  readonly distributed: readonly Space3DLocalDistributedLoad[];
  readonly points: readonly Space3DLocalPointLoad[];
  readonly moments: readonly Space3DLocalMomentLoad[];
}

export const EMPTY_LOCAL_LOADS: Space3DLocalLoadSet = Object.freeze({
  distributed: Object.freeze([]), points: Object.freeze([]), moments: Object.freeze([]),
});

const toLocal = (basis: Space3DOrientationBasis, vector: Vec3): Vec3 => [
  basis.x[0] * vector[0] + basis.x[1] * vector[1] + basis.x[2] * vector[2],
  basis.y[0] * vector[0] + basis.y[1] * vector[1] + basis.y[2] * vector[2],
  basis.z[0] * vector[0] + basis.z[1] * vector[1] + basis.z[2] * vector[2],
];

const isZero = (vector: Vec3) => vector[0] === 0 && vector[1] === 0 && vector[2] === 0;

/** Densidad de masa, kg/m³: la declarada en la barra o la del material de catálogo. */
const space3DMemberDensity = (member: Space3DFrameMember): number => {
  if (member.density !== undefined && Number.isFinite(member.density) && member.density > 0) return member.density;
  const material = member.materialId ? SPACE3D_MATERIALS.find((item) => item.id === member.materialId) : undefined;
  return material?.massDensityKgPerM3 ?? 0;
};

/** Peso por metro de la barra, kN/m. */
const space3DMemberWeightPerLength = (member: Space3DFrameMember): number =>
  space3DMemberDensity(member) * SPACE3D_GRAVITY * member.A / 1000;

/**
 * Factor de peso propio del objetivo: Σ (factor del caso en el objetivo) ×
 * (multiplicador de peso propio del caso).
 */
export const space3DSelfWeightFactor = (project: Space3DProjectV1, factors: ReadonlyMap<string, number>): number =>
  project.loadCases.reduce((sum, loadCase) => {
    const multiplier = loadCase.selfWeightFactor ?? 0;
    const factor = factors.get(loadCase.id) ?? 0;
    return multiplier !== 0 && factor !== 0 ? sum + multiplier * factor : sum;
  }, 0);

interface ResolveInput {
  readonly member: Space3DFrameMember;
  readonly memberLoads: readonly Space3DMemberLoad[];
  readonly start: Space3DVector;
  readonly end: Space3DVector;
  readonly basis: Space3DOrientationBasis;
  readonly factors: ReadonlyMap<string, number>;
  /** Σ factor × multiplicador de peso propio; 0 lo omite. */
  readonly selfWeightFactor: number;
}

/**
 * Proyección de la longitud: una carga «por metro horizontal» sobre una barra
 * inclinada reparte la misma resultante en más longitud real.
 */
const lengthBasisFactor = (basis: Space3DMemberLoad['lengthBasis'], start: Space3DVector, end: Space3DVector): number => {
  if (basis === 'real') return 1;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dy, dz);
  if (!(length > 0)) return 0;
  // Y es la vertical global.
  return basis === 'horizontal' ? Math.hypot(dx, dz) / length : Math.abs(dy) / length;
};

export const resolveSpace3DMemberLoads = (input: ResolveInput): Space3DLocalLoadSet => {
  const { member, memberLoads, start, end, basis, factors, selfWeightFactor } = input;
  const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  const distributed: Space3DLocalDistributedLoad[] = [];
  const points: Space3DLocalPointLoad[] = [];
  const moments: Space3DLocalMomentLoad[] = [];
  const orient = (system: Space3DMemberLoad['coordinateSystem'], vector: Vec3): Vec3 => (system === 'local' ? vector : toLocal(basis, vector));

  for (const load of memberLoads) {
    if (load.memberId !== member.id) continue;
    const factor = factors.get(load.caseId) ?? 0;
    if (factor === 0) continue;
    if (load.type === 'distributed') {
      const scale = factor * lengthBasisFactor(load.lengthBasis, start, end);
      const a = Math.min(load.start, load.end) * length;
      const b = Math.max(load.start, load.end) * length;
      if (!(b > a) || scale === 0) continue;
      const q1 = orient(load.coordinateSystem, [(load.qxStart ?? 0) * scale, (load.qyStart ?? 0) * scale, (load.qzStart ?? 0) * scale]);
      const q2 = orient(load.coordinateSystem, [(load.qxEnd ?? 0) * scale, (load.qyEnd ?? 0) * scale, (load.qzEnd ?? 0) * scale]);
      if (isZero(q1) && isZero(q2)) continue;
      distributed.push({ a, b, q1, q2 });
    } else if (load.type === 'point') {
      const p = orient(load.coordinateSystem, [(load.px ?? 0) * factor, (load.py ?? 0) * factor, (load.pz ?? 0) * factor]);
      if (isZero(p)) continue;
      points.push({ a: (load.position ?? 0.5) * length, p });
    } else {
      // `moment` es el escalar planar: gira alrededor de Z del sistema elegido.
      const m = orient(load.coordinateSystem, [(load.mx ?? 0) * factor, (load.my ?? 0) * factor, ((load.mz ?? 0) + (load.moment ?? 0)) * factor]);
      if (isZero(m)) continue;
      moments.push({ a: (load.position ?? 0.5) * length, m });
    }
  }

  if (selfWeightFactor !== 0) {
    const weight = space3DMemberWeightPerLength(member) * selfWeightFactor;
    if (weight !== 0) {
      const q = toLocal(basis, [0, -weight, 0]);
      distributed.push({ a: 0, b: length, q1: q, q2: q });
    }
  }

  return { distributed, points, moments };
};

/** Gauss–Legendre de 4 puntos en [-1, 1]: exacto hasta grado 7. */
const GAUSS_POINTS = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526] as const;
const GAUSS_WEIGHTS = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538] as const;

const integrate = (from: number, to: number, fn: (s: number) => number): number => {
  if (!(to > from)) return 0;
  const half = (to - from) / 2;
  const mid = (to + from) / 2;
  let sum = 0;
  for (let index = 0; index < GAUSS_POINTS.length; index += 1) sum += GAUSS_WEIGHTS[index] * fn(mid + half * GAUSS_POINTS[index]);
  return sum * half;
};

const interpolate = (load: Space3DLocalDistributedLoad, s: number, component: 0 | 1 | 2): number => {
  const t = load.b > load.a ? (s - load.a) / (load.b - load.a) : 0;
  return load.q1[component] + (load.q2[component] - load.q1[component]) * t;
};

/** Funciones de forma y sus derivadas en `ξ = x/L`. */
const hermite = (xi: number, L: number) => [
  1 - 3 * xi ** 2 + 2 * xi ** 3,
  L * (xi - 2 * xi ** 2 + xi ** 3),
  3 * xi ** 2 - 2 * xi ** 3,
  L * (-(xi ** 2) + xi ** 3),
] as const;

const hermiteSlope = (xi: number, L: number) => [
  (-6 * xi + 6 * xi ** 2) / L,
  1 - 4 * xi + 3 * xi ** 2,
  (6 * xi - 6 * xi ** 2) / L,
  -2 * xi + 3 * xi ** 2,
] as const;

/**
 * Vector de cargas consistente en ejes locales (12 términos). Para una
 * armadura la flexión usa funciones lineales y no hay términos de giro.
 */
const consistentLoadVector = (loads: Space3DLocalLoadSet, length: number, kind: 'frame' | 'truss'): number[] => {
  const L = length;
  const f = new Array<number>(12).fill(0);

  const addTransverse = (position: number, qy: number, qz: number) => {
    const xi = position / L;
    if (kind === 'truss') {
      f[1] += qy * (1 - xi); f[7] += qy * xi;
      f[2] += qz * (1 - xi); f[8] += qz * xi;
      return;
    }
    const [n1, n2, n3, n4] = hermite(xi, L);
    f[1] += qy * n1; f[5] += qy * n2; f[7] += qy * n3; f[11] += qy * n4;
    // Plano x–z: `ry = −dw/dx`, de ahí el signo de los términos de giro.
    f[2] += qz * n1; f[4] -= qz * n2; f[8] += qz * n3; f[10] -= qz * n4;
  };
  const addAxial = (position: number, qx: number) => {
    const xi = position / L;
    f[0] += qx * (1 - xi); f[6] += qx * xi;
  };

  for (const load of loads.distributed) {
    // Integrando polinómico de grado ≤ 4: la cuadratura de 4 puntos es exacta.
    for (const node of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const contribution = integrate(load.a, load.b, (s) => {
        const xi = s / L;
        const qx = interpolate(load, s, 0);
        const qy = interpolate(load, s, 1);
        const qz = interpolate(load, s, 2);
        if (node === 0) return qx * (1 - xi);
        if (node === 6) return qx * xi;
        if (kind === 'truss') {
          if (node === 1) return qy * (1 - xi);
          if (node === 7) return qy * xi;
          if (node === 2) return qz * (1 - xi);
          if (node === 8) return qz * xi;
          return 0;
        }
        const [n1, n2, n3, n4] = hermite(xi, L);
        if (node === 1) return qy * n1;
        if (node === 5) return qy * n2;
        if (node === 7) return qy * n3;
        if (node === 11) return qy * n4;
        if (node === 2) return qz * n1;
        if (node === 4) return -qz * n2;
        if (node === 8) return qz * n3;
        if (node === 10) return -qz * n4;
        return 0;
      });
      f[node] += contribution;
    }
  }

  for (const load of loads.points) {
    addAxial(load.a, load.p[0]);
    addTransverse(load.a, load.p[1], load.p[2]);
  }

  for (const load of loads.moments) {
    const xi = load.a / L;
    const [mx, my, mz] = load.m;
    if (kind === 'truss') {
      // Barra biarticulada: el par se equilibra con un par de fuerzas en los extremos.
      f[1] += -mz / L; f[7] += mz / L;
      f[2] += my / L; f[8] += -my / L;
      continue;
    }
    f[3] += mx * (1 - xi); f[9] += mx * xi;
    const [d1, d2, d3, d4] = hermiteSlope(xi, L);
    // Trabajo de Mz sobre `rz = dv/dx`.
    f[1] += mz * d1; f[5] += mz * d2; f[7] += mz * d3; f[11] += mz * d4;
    // Trabajo de My sobre `ry = −dw/dx`.
    f[2] += -my * d1; f[4] += my * d2; f[8] += -my * d3; f[10] += my * d4;
  }

  return f;
};

/** Fuerzas de empotramiento perfecto, locales: acciones de los nudos sobre la barra. */
export const space3DFixedEndForces = (loads: Space3DLocalLoadSet, length: number, kind: 'frame' | 'truss'): number[] =>
  consistentLoadVector(loads, length, kind).map((value) => (value === 0 ? 0 : -value));

export const hasSpace3DLocalLoads = (loads: Space3DLocalLoadSet): boolean =>
  loads.distributed.length > 0 || loads.points.length > 0 || loads.moments.length > 0;

interface InternalForces {
  readonly N: number;
  readonly Vy: number;
  readonly Vz: number;
  readonly T: number;
  readonly My: number;
  readonly Mz: number;
}

/**
 * Esfuerzos en la sección `x` por equilibrio del tramo `[0, x]`. `inclusive`
 * decide si una carga concentrada justo en `x` ya cuenta: da el valor a la
 * derecha del salto; sin ella, el de la izquierda.
 */
const internalForcesAt = (x: number, startForces: readonly number[], loads: Space3DLocalLoadSet, inclusive: boolean): InternalForces => {
  const [Fx, Fy, Fz, Mx, My, Mz] = startForces;
  let N = -Fx;
  let Vy = -Fy;
  let Vz = -Fz;
  let T = -Mx;
  let momentY = -My - x * Fz;
  let momentZ = -Mz + x * Fy;

  for (const load of loads.distributed) {
    const to = Math.min(x, load.b);
    if (!(to > load.a)) continue;
    const q0 = integrate(load.a, to, (s) => interpolate(load, s, 0));
    const q1 = integrate(load.a, to, (s) => interpolate(load, s, 1));
    const q2 = integrate(load.a, to, (s) => interpolate(load, s, 2));
    const arm1 = integrate(load.a, to, (s) => (s - x) * interpolate(load, s, 1));
    const arm2 = integrate(load.a, to, (s) => (s - x) * interpolate(load, s, 2));
    N -= q0;
    Vy -= q1;
    Vz -= q2;
    momentY += arm2;
    momentZ -= arm1;
  }
  const counts = (position: number) => (inclusive ? position <= x : position < x);
  for (const load of loads.points) {
    if (!counts(load.a)) continue;
    N -= load.p[0];
    Vy -= load.p[1];
    Vz -= load.p[2];
    momentY += (load.a - x) * load.p[2];
    momentZ -= (load.a - x) * load.p[1];
  }
  for (const load of loads.moments) {
    if (!counts(load.a)) continue;
    T -= load.m[0];
    momentY -= load.m[1];
    momentZ -= load.m[2];
  }
  return { N, Vy, Vz, T, My: momentY, Mz: momentZ };
};

interface StationInput {
  readonly length: number;
  readonly kind: 'frame' | 'truss';
  readonly E: number;
  readonly Iy: number;
  readonly Iz: number;
  /** Fuerzas locales de extremo de la barra (12), acciones de los nudos sobre ella. */
  readonly endForces: readonly number[];
  /** Desplazamientos locales del propio extremo de la barra (12). */
  readonly endDisplacements: readonly number[];
  readonly loads: Space3DLocalLoadSet;
  /** Tramos uniformes además de los puntos singulares de carga. */
  readonly segments?: number;
}

const DEFLECTION_SEGMENTS = 24;

/**
 * Estaciones ordenadas por `x`. En una carga concentrada se repite la
 * posición: primero el valor a la izquierda del salto y después el de la
 * derecha, que es lo que un diagrama necesita para dibujar el escalón.
 */
export const computeSpace3DMemberStations = (input: StationInput): readonly Space3DMemberStation[] => {
  const { length: L, loads, endForces, endDisplacements } = input;
  const segments = Math.max(2, Math.trunc(input.segments ?? 12));
  const singular = [
    ...loads.points.map((load) => load.a),
    ...loads.moments.map((load) => load.a),
  ].filter((a) => a > 1e-9 && a < L - 1e-9);
  const breaks = loads.distributed.flatMap((load) => [load.a, load.b]).filter((a) => a > 1e-9 && a < L - 1e-9);
  const positions = [...new Set([
    ...Array.from({ length: segments + 1 }, (_, index) => (L * index) / segments),
    ...breaks,
    ...singular,
  ].map((value) => Number(value.toPrecision(12))))].sort((a, b) => a - b);

  const startForces = endForces.slice(0, 6);

  // Elástica: v'' = Mz/EIz y w'' = −My/EIy con los extremos en su sitio. En
  // cada tramo entre puntos singulares el momento es un polinomio de grado
  // ≤ 3, así que la cuadratura de Gauss integra exacto:
  //   θₖ₊₁ = θₖ + ∫κ,   vₖ₊₁ = vₖ + h·θₖ + ∫(xₖ₊₁ − s)·κ(s) ds.
  const flexible = input.kind === 'frame' && input.E > 0;
  const fine = [...new Set([
    ...positions,
    ...Array.from({ length: DEFLECTION_SEGMENTS + 1 }, (_, index) => Number(((L * index) / DEFLECTION_SEGMENTS).toPrecision(12))),
  ])].sort((a, b) => a - b);
  const deflection = (curvature: (s: number) => number): Map<number, number> => {
    const values = [0];
    let slope = 0;
    for (let index = 1; index < fine.length; index += 1) {
      const from = fine[index - 1];
      const to = fine[index];
      const h = to - from;
      values.push(values[index - 1] + h * slope + integrate(from, to, (s) => (to - s) * curvature(s)));
      slope += integrate(from, to, curvature);
    }
    const last = values[values.length - 1];
    return new Map(fine.map((x, index) => [x, values[index] - (last * x) / L]));
  };
  const particularV = flexible && input.Iz > 0
    ? deflection((s) => internalForcesAt(s, startForces, loads, false).Mz / (input.E * input.Iz))
    : null;
  const particularW = flexible && input.Iy > 0
    ? deflection((s) => -internalForcesAt(s, startForces, loads, false).My / (input.E * input.Iy))
    : null;
  const sample = (values: Map<number, number> | null, x: number): number => values?.get(x) ?? 0;

  const [ui, vi, wi] = [endDisplacements[0], endDisplacements[1], endDisplacements[2]];
  const [uj, vj, wj] = [endDisplacements[6], endDisplacements[7], endDisplacements[8]];
  const station = (x: number, forces: InternalForces): Space3DMemberStation => {
    const t = L > 0 ? x / L : 0;
    return Object.freeze({
      x,
      N: forces.N,
      Vy: forces.Vy,
      Vz: forces.Vz,
      T: forces.T,
      My: forces.My,
      Mz: forces.Mz,
      u: ui + (uj - ui) * t,
      v: vi + (vj - vi) * t + sample(particularV, x),
      w: wi + (wj - wi) * t + sample(particularW, x),
    });
  };

  const singularSet = new Set(singular.map((value) => Number(value.toPrecision(12))));
  const stations: Space3DMemberStation[] = [];
  for (const x of positions) {
    if (singularSet.has(x)) {
      stations.push(station(x, internalForcesAt(x, startForces, loads, false)));
      stations.push(station(x, internalForcesAt(x, startForces, loads, true)));
    } else {
      // En los extremos no hay «otro lado»: una carga justo en el extremo ya cuenta.
      stations.push(station(x, internalForcesAt(x, startForces, loads, x <= 0 || x >= L)));
    }
  }
  return Object.freeze(stations);
};
