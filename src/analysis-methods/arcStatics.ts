/**
 * Estática de una barra curva (arco circular nativo, `member.curve`), sin rigideces.
 *
 * El método de secciones y el de trabajo mínimo en arcos necesitan lo mismo de un arco: dónde
 * está cada punto, hacia dónde apunta su tangente, cuánto pesa cada trozo de carga y dónde
 * actúa, y —al cortar en un punto— cuánto valen N, V y M en el cuerpo libre izquierdo. Aquí se
 * calcula todo eso sobre el arco verdadero, no sobre las cuerdas con las que el solver lo malla.
 *
 * Parámetro: la fracción t ∈ [0, 1] del arco desde el nudo i (la misma `position`, `start` y
 * `end` de las cargas de barra). La distancia a lo largo del arco es s = t·L.
 *
 * Lectura de las cargas: la misma que `prepareCurvedAnalysis` da al solver.
 *  - Repartida con base «longitud real»: intensidad por metro de arco.
 *  - Base «proyección horizontal» o «vertical»: intensidad por metro de proyección, |dx| o |dy|.
 *  - Ejes locales: x a lo largo de la tangente, y hacia la izquierda de i→j (la normal).
 *  - La intensidad varía linealmente con t entre `start` y `end`.
 *  - Puntual en ejes locales: girada con la tangente en su punto.
 * Las integrales se hacen con Gauss–Legendre de 24 puntos por tramo liso: el integrando es un
 * polinomio de grado 1 por senos y cosenos de un ángulo de a lo más 180°, así que la cuadratura
 * es exacta a la precisión de la máquina.
 *
 * Convención de fuerzas internas (la del solver tras girar las cuerdas a la tangente): N
 * positiva a tensión a lo largo de la tangente, V positiva hacia la izquierda de i→j (la normal
 * n = tangente girada +90°) como suma de las fuerzas del cuerpo libre izquierdo, y M = −ΣM del
 * cuerpo libre izquierdo respecto al punto de corte (positivo con dM/ds = V en una viga recta).
 */
import { circularMemberGeometry, curvePointAt, curveTangentAt, type CircularArcGeometry } from '../graphics/memberCurve';
import type { MemberModel, NodeModel, ProjectModel } from '../types';

export interface Vec2 {
  x: number;
  y: number;
}

export type ArcLoadBasis = 'real' | 'horizontal' | 'vertical';

/** Repartida sobre [t0, t1], ya factorizada; intensidad lineal en t. */
export interface ArcDistributedLoad {
  kind: 'distributed';
  label: string;
  t0: number;
  t1: number;
  qxA: number;
  qxB: number;
  qyA: number;
  qyB: number;
  system: 'global' | 'local';
  basis: ArcLoadBasis;
  /** Multiplicador del escenario ya aplicado (para narrarlo). */
  factor?: number;
}

/** Fuerza concentrada en t, en ejes globales y ya factorizada. */
export interface ArcPointLoad {
  kind: 'point';
  label: string;
  t: number;
  fx: number;
  fy: number;
  factor?: number;
}

/** Par concentrado en t, antihorario positivo. */
export interface ArcCoupleLoad {
  kind: 'couple';
  label: string;
  t: number;
  moment: number;
  factor?: number;
}

export type ArcLoad = ArcDistributedLoad | ArcPointLoad | ArcCoupleLoad;

/** Fuerza y momento (respecto a un punto dado) de un conjunto de acciones. */
export interface ArcResultant {
  fx: number;
  fy: number;
  moment: number;
}

const cross = (r: Vec2, f: Vec2): number => r.x * f.y - r.y * f.x;

/** Punto del arco en la fracción t (los extremos, exactos). */
export const arcPoint = (arc: CircularArcGeometry, t: number): Vec2 => curvePointAt(arc, t);

/** Tangente unitaria en t, en el sentido de i hacia j. */
export const arcTangent = (arc: CircularArcGeometry, t: number): Vec2 => curveTangentAt(arc, t);

/** Normal unitaria en t: la tangente girada +90°, hacia la izquierda de i→j. */
export const arcNormal = (arc: CircularArcGeometry, t: number): Vec2 => {
  const tangent = arcTangent(arc, t);
  return { x: -tangent.y, y: tangent.x };
};

/** Inclinación de la tangente respecto a +x, en radianes, en (−π, π]. */
export const arcSlope = (arc: CircularArcGeometry, t: number): number => {
  const tangent = arcTangent(arc, t);
  return Math.atan2(tangent.y, tangent.x);
};

/** Geometría del arco de una barra, o `undefined` si la barra es recta o le falta un nudo. */
export const memberArc = (member: MemberModel, nodes: ReadonlyMap<string, NodeModel>): CircularArcGeometry | undefined => {
  if (!member.curve) return undefined;
  const ni = nodes.get(member.i);
  const nj = nodes.get(member.j);
  if (!ni || !nj) return undefined;
  try {
    return circularMemberGeometry(member, ni, nj);
  } catch {
    return undefined;
  }
};

// ---- Cuadratura -------------------------------------------------------------------------------

const legendre = (n: number): { nodes: number[]; weights: number[] } => {
  const nodes: number[] = [];
  const weights: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    let x = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let derivative = 1;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let p0 = 1;
      let p1 = x;
      for (let k = 2; k <= n; k += 1) {
        const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      derivative = (n * (x * p1 - p0)) / (x * x - 1);
      const step = p1 / derivative;
      x -= step;
      if (Math.abs(step) < 1e-16) break;
    }
    nodes.push(x);
    weights.push(2 / ((1 - x * x) * derivative * derivative));
  }
  return { nodes, weights };
};

const GAUSS = legendre(24);

/** ∫ f(t) dt en [a, b] con Gauss–Legendre de 24 puntos. */
const gauss = (f: (t: number) => number[], a: number, b: number, size: number): number[] => {
  const sum = new Array<number>(size).fill(0);
  if (!(b > a)) return sum;
  const half = (b - a) / 2;
  const mid = (a + b) / 2;
  GAUSS.nodes.forEach((node, index) => {
    const values = f(mid + half * node);
    const weight = GAUSS.weights[index]! * half;
    for (let k = 0; k < size; k += 1) sum[k] += weight * values[k]!;
  });
  return sum;
};

/**
 * Peso de la base de una repartida por unidad de t: dL/dt de la longitud a la que se refiere la
 * intensidad (arco, proyección horizontal o vertical).
 */
const basisRate = (arc: CircularArcGeometry, basis: ArcLoadBasis, t: number): number => {
  if (basis === 'real') return arc.length;
  const tangent = arcTangent(arc, t);
  return Math.abs(basis === 'horizontal' ? tangent.x : tangent.y) * arc.length;
};

/** Fuerza global por unidad de t de una repartida en t. */
export const distributedDensity = (arc: CircularArcGeometry, load: ArcDistributedLoad, t: number): Vec2 => {
  const u = load.t1 > load.t0 ? (t - load.t0) / (load.t1 - load.t0) : 0;
  const qx = load.qxA + (load.qxB - load.qxA) * u;
  const qy = load.qyA + (load.qyB - load.qyA) * u;
  const rate = basisRate(arc, load.basis, t);
  if (load.system === 'local') {
    const tangent = arcTangent(arc, t);
    return { x: (tangent.x * qx - tangent.y * qy) * rate, y: (tangent.y * qx + tangent.x * qy) * rate };
  }
  return { x: qx * rate, y: qy * rate };
};

/** Longitud de la base de una repartida sobre [a, b]: ∫ dL. */
export const basisLength = (arc: CircularArcGeometry, basis: ArcLoadBasis, a: number, b: number): number =>
  gauss((t) => [basisRate(arc, basis, t)], a, b, 1)[0]!;

/** ¿Cae una acción concentrada en t a la izquierda de un corte en `cut` (justo después de él)? */
export const leftOfCut = (t: number, cut: number): boolean => t < 1 - 1e-12 && t <= cut + 1e-12;

/**
 * Fuerza y momento, respecto a `about`, de las cargas del arco que caen en [a, b]. Las acciones
 * concentradas cuentan si están a la izquierda de un corte en b (o sea, a ≤ t ≤ b, salvo una
 * en el nudo j).
 */
export const arcLoadsResultant = (
  arc: CircularArcGeometry,
  loads: readonly ArcLoad[],
  a: number,
  b: number,
  about: Vec2,
): ArcResultant => {
  let fx = 0;
  let fy = 0;
  let moment = 0;
  for (const load of loads) {
    if (load.kind === 'distributed') {
      const from = Math.max(a, load.t0);
      const to = Math.min(b, load.t1);
      if (!(to > from)) continue;
      const [gx, gy, gm] = gauss((t) => {
        const density = distributedDensity(arc, load, t);
        const at = arcPoint(arc, t);
        return [density.x, density.y, cross({ x: at.x - about.x, y: at.y - about.y }, density)];
      }, from, to, 3);
      fx += gx!;
      fy += gy!;
      moment += gm!;
    } else if (load.t >= a - 1e-12 && leftOfCut(load.t, b)) {
      const at = arcPoint(arc, load.t);
      if (load.kind === 'point') {
        fx += load.fx;
        fy += load.fy;
        moment += cross({ x: at.x - about.x, y: at.y - about.y }, { x: load.fx, y: load.fy });
      } else {
        moment += load.moment;
      }
    }
  }
  return { fx, fy, moment };
};

/** Las acciones del arco completo (las concentradas en el nudo j incluidas): para el equilibrio global. */
export const arcLoadsTotal = (arc: CircularArcGeometry, loads: readonly ArcLoad[], about: Vec2): ArcResultant => {
  const own = arcLoadsResultant(arc, loads, 0, 1, about);
  for (const load of loads) {
    if (load.kind === 'distributed' || load.t < 1 - 1e-12) continue;
    const at = arcPoint(arc, load.t);
    if (load.kind === 'point') {
      own.fx += load.fx;
      own.fy += load.fy;
      own.moment += cross({ x: at.x - about.x, y: at.y - about.y }, { x: load.fx, y: load.fy });
    } else {
      own.moment += load.moment;
    }
  }
  return own;
};

/**
 * Un punto de la línea de acción de una resultante: el más cercano al centroide de la carga
 * (∫ r |dF| / ∫ |dF|). En una carga vertical es exactamente (x̄, ȳ) del centroide.
 */
export const lineOfActionPoint = (resultant: ArcResultant, about: Vec2, centroid: Vec2): Vec2 | undefined => {
  const magnitude = Math.hypot(resultant.fx, resultant.fy);
  if (!(magnitude > 0)) return undefined;
  const e = { x: resultant.fx / magnitude, y: resultant.fy / magnitude };
  // Points r on the line satisfy (r − about) × F = moment. The foot of the perpendicular from the
  // centroid: r = c + λ·n, n = (−e.y, e.x), with (c − about + λ n) × F = moment.
  const n = { x: -e.y, y: e.x };
  const base = cross({ x: centroid.x - about.x, y: centroid.y - about.y }, { x: resultant.fx, y: resultant.fy });
  const per = cross(n, { x: resultant.fx, y: resultant.fy });
  const lambda = Math.abs(per) > 0 ? (resultant.moment - base) / per : 0;
  return { x: centroid.x + lambda * n.x, y: centroid.y + lambda * n.y };
};

/** Centroide de |dF| de una repartida sobre [a, b]. */
export const distributedCentroid = (arc: CircularArcGeometry, load: ArcDistributedLoad, a: number, b: number): Vec2 | undefined => {
  const from = Math.max(a, load.t0);
  const to = Math.min(b, load.t1);
  if (!(to > from)) return undefined;
  const [w, wx, wy] = gauss((t) => {
    const density = distributedDensity(arc, load, t);
    const weight = Math.hypot(density.x, density.y);
    const at = arcPoint(arc, t);
    return [weight, weight * at.x, weight * at.y];
  }, from, to, 3);
  return w! > 0 ? { x: wx! / w!, y: wy! / w! } : undefined;
};

// ---- Cortes -----------------------------------------------------------------------------------

/** Lo que el lado del nudo i entrega a la barra en su inicio: fuerza y momento respecto a i. */
export interface ArcStartSide {
  fx: number;
  fy: number;
  /** Momento de las acciones del lado de i respecto al nudo i, antihorario. */
  moment: number;
}

export interface ArcCut {
  t: number;
  /** Distancia a lo largo del arco desde el nudo i. */
  s: number;
  point: Vec2;
  tangent: Vec2;
  /** Inclinación de la tangente, rad. */
  slope: number;
  /** Fuerza y momento (respecto al punto de corte) de las cargas del trozo [0, t]. */
  load: ArcResultant;
  /** Fuerza total del cuerpo libre izquierdo y su momento respecto al punto de corte. */
  left: ArcResultant;
  axial: number;
  shear: number;
  moment: number;
}

/** N, V y M en un corte en t, por equilibrio del cuerpo libre izquierdo. */
export const arcCutAt = (
  arc: CircularArcGeometry,
  loads: readonly ArcLoad[],
  start: ArcStartSide,
  t: number,
): ArcCut => {
  const point = arcPoint(arc, t);
  const tangent = arcTangent(arc, t);
  const load = arcLoadsResultant(arc, loads, 0, t, point);
  const origin = arc.start;
  const startMoment = start.moment + cross({ x: origin.x - point.x, y: origin.y - point.y }, { x: start.fx, y: start.fy });
  const left = { fx: start.fx + load.fx, fy: start.fy + load.fy, moment: startMoment + load.moment };
  return {
    t,
    s: t * arc.length,
    point,
    tangent,
    slope: Math.atan2(tangent.y, tangent.x),
    load,
    left,
    axial: -(left.fx * tangent.x + left.fy * tangent.y),
    shear: -left.fx * tangent.y + left.fy * tangent.x,
    moment: -left.moment,
  };
};

/** Fracciones donde una expresión cambia: bordes de repartidas y acciones concentradas. */
export const arcBreakpoints = (loads: readonly ArcLoad[]): number[] => {
  const values = loads.flatMap((load) => load.kind === 'distributed' ? [load.t0, load.t1] : [load.t]);
  const points = [0, ...values.filter((value) => value > 1e-9 && value < 1 - 1e-9), 1].sort((a, b) => a - b);
  return points.filter((value, index) => index === 0 || value - points[index - 1]! > 1e-9);
};

/** Fracciones a menos de 1e-6 de una acción concentrada, donde N, V o M saltan. */
export const nearConcentrated = (loads: readonly ArcLoad[], t: number): boolean =>
  loads.some((load) => load.kind !== 'distributed' && Math.abs(load.t - t) < 1e-6);

/**
 * Simpson compuesto sobre [0, 1] partido en los quiebres de carga, con unos `panels` intervalos
 * en total (repartidos según la longitud de cada tramo, siempre en número par por tramo). El
 * último punto de un tramo interior se marca `before`: ahí el integrando se lee justo antes del
 * quiebre, porque una acción concentrada hace saltar N y V.
 */
export const simpsonStations = (breakpoints: readonly number[], panels: number): { t: number; weight: number; before: boolean }[] => {
  const stations: { t: number; weight: number; before: boolean }[] = [];
  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const a = breakpoints[index]!;
    const b = breakpoints[index + 1]!;
    const n = Math.max(2, Math.round((panels * (b - a)) / 2) * 2);
    const h = (b - a) / n;
    for (let k = 0; k <= n; k += 1) {
      const coefficient = k === 0 || k === n ? 1 : k % 2 ? 4 : 2;
      stations.push({ t: a + k * h, weight: (coefficient * h) / 3, before: k === n && index < breakpoints.length - 2 });
    }
  }
  return stations;
};

/**
 * Cargas de una barra curva bajo la combinación: las de barra del proyecto y el peso propio,
 * leídas como las lee el solver. `factors` es el multiplicador de cada caso.
 */
export const arcLoadsOf = (
  project: ProjectModel,
  member: MemberModel,
  arc: CircularArcGeometry,
  factors: Readonly<Record<string, number>>,
): ArcLoad[] => {
  const loads: ArcLoad[] = [];
  for (const load of project.memberLoads) {
    if (load.memberId !== member.id) continue;
    const factor = factors[load.caseId] ?? 0;
    if (!factor) continue;
    if (load.type === 'point') {
      const t = Math.min(1, Math.max(0, load.position ?? 0.5));
      const px = (load.px ?? 0) * factor;
      const py = (load.py ?? 0) * factor;
      if (load.coordinateSystem === 'local') {
        const tangent = arcTangent(arc, t);
        loads.push({ kind: 'point', label: load.id, t, fx: tangent.x * px - tangent.y * py, fy: tangent.y * px + tangent.x * py, factor });
      } else {
        loads.push({ kind: 'point', label: load.id, t, fx: px, fy: py, factor });
      }
      continue;
    }
    if (load.type === 'moment') {
      const t = Math.min(1, Math.max(0, load.position ?? 0.5));
      loads.push({ kind: 'couple', label: load.id, t, moment: (load.moment ?? 0) * factor, factor });
      continue;
    }
    if (!(load.end > load.start)) continue;
    loads.push({
      kind: 'distributed', label: load.id, t0: load.start, t1: load.end,
      qxA: (load.qxStart ?? 0) * factor, qxB: (load.qxEnd ?? load.qxStart ?? 0) * factor,
      qyA: (load.qyStart ?? 0) * factor, qyB: (load.qyEnd ?? load.qyStart ?? 0) * factor,
      system: load.coordinateSystem === 'local' ? 'local' : 'global',
      basis: load.lengthBasis ?? 'real',
      factor,
    });
  }
  const selfWeightFactor = project.loadCases.reduce(
    (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
    0,
  );
  if (selfWeightFactor !== 0 && member.density && member.A > 0) {
    const weight = (member.density * 9.80665 * member.A) / 1000 * selfWeightFactor;
    loads.push({
      kind: 'distributed', label: 'peso propio', t0: 0, t1: 1, qxA: 0, qxB: 0, qyA: -weight, qyB: -weight,
      system: 'global', basis: 'real', factor: selfWeightFactor,
    });
  }
  return loads;
};

/** Una repartida de dirección fija e intensidad constante: su resultante es q·L. */
export const isUniformGlobal = (load: ArcDistributedLoad): boolean =>
  load.system === 'global' && load.qxA === load.qxB && load.qyA === load.qyB;

