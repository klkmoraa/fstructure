import { factorizeLinearSystem, zeros, type Matrix } from '../../foundation/linearAlgebra';

/**
 * Análisis elástico lineal de un marco plano para el taller de Diseño.
 *
 * Rigidez directa con elementos de Euler-Bernoulli (axial y flexión), carga
 * uniforme en cada miembro y cargas en los nudos. Todos los casos comparten una
 * sola factorización de la matriz de rigidez: un pórtico de cinco niveles y
 * cinco claros con medio centenar de casos de carga se resuelve en unos
 * milisegundos, lo que permite recalcular mientras se edita. Las convenciones
 * son las del solver 2D (`src/engine`), contra el que se valida en
 * `frameAnalysis.test.ts`:
 *
 * - ejes globales X a la derecha, Y hacia arriba; giro positivo antihorario;
 * - eje local x del nudo i al j; y local girado 90° antihorario;
 * - fuerza axial positiva en tensión;
 * - momento positivo con tensión del lado −y local (abajo en vigas que van de
 *   izquierda a derecha; cara +X en columnas que suben).
 */

export interface FrameNode {
  readonly x: number;
  readonly y: number;
  /** Restricciones [ux, uy, rz]. */
  readonly restraint: readonly [boolean, boolean, boolean];
}

export interface FrameMember {
  readonly i: number;
  readonly j: number;
  /** kN/m². */
  readonly elasticModulusKpa: number;
  /** m². */
  readonly areaM2: number;
  /** m⁴. */
  readonly inertiaM4: number;
}

export interface FrameLoadCase {
  readonly id: string;
  /** Carga uniforme por miembro en dirección −Y global (gravedad), kN/m de longitud real. */
  readonly gravity?: Readonly<Record<number, number>>;
  /** Fuerzas en los nudos, kN (globales). */
  readonly nodal?: readonly { readonly node: number; readonly fx: number; readonly fy: number }[];
}

export interface FrameModel {
  readonly nodes: readonly FrameNode[];
  readonly members: readonly FrameMember[];
}

export interface MemberCaseResult {
  /** Fuerzas de los nudos sobre el miembro en ejes locales: [Ni, Vi, Mi, Nj, Vj, Mj]. */
  readonly endForces: readonly number[];
  /** Desplazamientos de los extremos en ejes locales: [ui, vi, θi, uj, vj, θj]. */
  readonly displacements: readonly number[];
  /** Carga distribuida en ejes locales, kN/m. */
  readonly px: number;
  readonly qy: number;
}

export interface FrameCaseResult {
  readonly id: string;
  /** Desplazamientos por nudo [ux, uy, rz] en m y rad. */
  readonly nodeDisplacements: readonly (readonly [number, number, number])[];
  readonly members: readonly MemberCaseResult[];
}

export interface MemberGeometry {
  readonly lengthM: number;
  readonly cos: number;
  readonly sin: number;
}

export interface FrameAnalysis {
  readonly geometry: readonly MemberGeometry[];
  readonly cases: readonly FrameCaseResult[];
}

export type FrameAnalysisOutcome = { readonly ok: true; readonly analysis: FrameAnalysis } | { readonly ok: false; readonly error: string };

const memberGeometry = (model: FrameModel, index: number): MemberGeometry => {
  const member = model.members[index]!;
  const a = model.nodes[member.i]!;
  const b = model.nodes[member.j]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthM = Math.hypot(dx, dy);
  return { lengthM, cos: dx / lengthM, sin: dy / lengthM };
};

/** Rigidez local 6×6 del elemento de marco. */
function localStiffness(member: FrameMember, length: number): Matrix {
  const ea = member.elasticModulusKpa * member.areaM2 / length;
  const ei = member.elasticModulusKpa * member.inertiaM4;
  const k1 = 12 * ei / length ** 3;
  const k2 = 6 * ei / length ** 2;
  const k3 = 4 * ei / length;
  const k4 = 2 * ei / length;
  return [
    [ea, 0, 0, -ea, 0, 0],
    [0, k1, k2, 0, -k1, k2],
    [0, k2, k3, 0, -k2, k4],
    [-ea, 0, 0, ea, 0, 0],
    [0, -k1, -k2, 0, k1, -k2],
    [0, k2, k4, 0, -k2, k3],
  ];
}

/** Global → local: d_local = T · d_global. */
const toLocal = (g: MemberGeometry, global: readonly number[]) => {
  const { cos: c, sin: s } = g;
  const local: number[] = [];
  for (const offset of [0, 3]) {
    const x = global[offset]!;
    const y = global[offset + 1]!;
    local.push(c * x + s * y, -s * x + c * y, global[offset + 2]!);
  }
  return local;
};

/** Local → global: v_global = Tᵀ · v_local. */
const toGlobal = (g: MemberGeometry, local: readonly number[]) => {
  const { cos: c, sin: s } = g;
  const global: number[] = [];
  for (const offset of [0, 3]) {
    const x = local[offset]!;
    const y = local[offset + 1]!;
    global.push(c * x - s * y, s * x + c * y, local[offset + 2]!);
  }
  return global;
};

/** Fuerzas de empotramiento (de los nudos sobre el miembro) por carga uniforme local. */
const fixedEndForces = (px: number, qy: number, length: number) => [
  -px * length / 2, -qy * length / 2, -qy * length ** 2 / 12,
  -px * length / 2, -qy * length / 2, qy * length ** 2 / 12,
];

const isUsable = (value: number) => Number.isFinite(value) && value > 0;

/** Resuelve todos los casos con una sola factorización. */
export function analyzeFrame(model: FrameModel, cases: readonly FrameLoadCase[]): FrameAnalysisOutcome {
  if (!model.nodes.length || !model.members.length) return { ok: false, error: 'El marco no tiene nudos o miembros.' };
  const geometry = model.members.map((_, index) => memberGeometry(model, index));
  if (geometry.some((g) => !isUsable(g.lengthM))) return { ok: false, error: 'Hay miembros de longitud nula.' };
  if (model.members.some((member) => !isUsable(member.elasticModulusKpa) || !isUsable(member.areaM2) || !isUsable(member.inertiaM4))) {
    return { ok: false, error: 'Las propiedades de los miembros deben ser positivas.' };
  }

  // Grados de libertad libres.
  const freeIndex: number[] = [];
  let free = 0;
  model.nodes.forEach((node) => node.restraint.forEach((restrained) => { freeIndex.push(restrained ? -1 : free); if (!restrained) free += 1; }));
  if (free === 0) return { ok: false, error: 'Todos los grados de libertad están restringidos.' };

  const stiffness = zeros(free, free);
  const locals = model.members.map((member, index) => localStiffness(member, geometry[index]!.lengthM));
  const dofsOf = (index: number) => {
    const member = model.members[index]!;
    return [0, 1, 2].map((d) => 3 * member.i + d).concat([0, 1, 2].map((d) => 3 * member.j + d));
  };
  model.members.forEach((_, index) => {
    const g = geometry[index]!;
    const k = locals[index]!;
    const dofs = dofsOf(index);
    // K_global = Tᵀ k T, columna a columna.
    for (let col = 0; col < 6; col += 1) {
      const unit = Array.from({ length: 6 }, (_, row) => (row === col ? 1 : 0));
      const localDisplacement = toLocal(g, unit);
      const localForce = k.map((row) => row.reduce((total, value, position) => total + value * localDisplacement[position]!, 0));
      const globalForce = toGlobal(g, localForce);
      const c = freeIndex[dofs[col]!]!;
      if (c < 0) continue;
      for (let row = 0; row < 6; row += 1) {
        const r = freeIndex[dofs[row]!]!;
        if (r >= 0) stiffness[r]![c]! += globalForce[row]!;
      }
    }
  });

  let factorization: ReturnType<typeof factorizeLinearSystem>;
  try {
    factorization = factorizeLinearSystem(stiffness);
  } catch {
    return { ok: false, error: 'El marco es inestable: revisa los apoyos y la conexión de los miembros.' };
  }
  if (!(factorization.minPivot > factorization.maxPivot * 1e-13)) {
    return { ok: false, error: 'El marco es inestable: revisa los apoyos y la conexión de los miembros.' };
  }

  const results: FrameCaseResult[] = cases.map((loadCase) => {
    const load = Array.from({ length: free }, () => 0);
    const distributed = model.members.map((_, index) => {
      const w = loadCase.gravity?.[index] ?? 0;
      const g = geometry[index]!;
      // Gravedad (0, −w) proyectada en ejes locales.
      return { px: -w * g.sin, qy: -w * g.cos };
    });
    model.members.forEach((_, index) => {
      const { px, qy } = distributed[index]!;
      if (px === 0 && qy === 0) return;
      const equivalent = toGlobal(geometry[index]!, fixedEndForces(px, qy, geometry[index]!.lengthM)).map((value) => -value);
      dofsOf(index).forEach((dof, position) => {
        const r = freeIndex[dof]!;
        if (r >= 0) load[r]! += equivalent[position]!;
      });
    });
    for (const item of loadCase.nodal ?? []) {
      const rx = freeIndex[3 * item.node]!;
      const ry = freeIndex[3 * item.node + 1]!;
      if (rx >= 0) load[rx]! += item.fx;
      if (ry >= 0) load[ry]! += item.fy;
    }
    const solution = factorization.solve(load);
    const full = freeIndex.map((index) => (index >= 0 ? solution[index]! : 0));
    const nodeDisplacements = model.nodes.map((_, node) => [full[3 * node]!, full[3 * node + 1]!, full[3 * node + 2]!] as const);
    const members = model.members.map((_, index) => {
      const g = geometry[index]!;
      const displacements = toLocal(g, dofsOf(index).map((dof) => full[dof]!));
      const { px, qy } = distributed[index]!;
      const fixed = fixedEndForces(px, qy, g.lengthM);
      const endForces = locals[index]!.map((row, r) => row.reduce((total, value, position) => total + value * displacements[position]!, 0) + fixed[r]!);
      return { endForces, displacements, px, qy };
    });
    return { id: loadCase.id, nodeDisplacements, members };
  });
  return { ok: true, analysis: { geometry, cases: results } };
}

export interface MemberAction {
  /** Tensión positiva, kN. */
  readonly axial: number;
  readonly shear: number;
  readonly moment: number;
  /** Desplazamientos locales en x: axial u y transversal v, m. */
  readonly u: number;
  readonly v: number;
}

/** Acciones internas y desplazamientos de un miembro a la distancia `x` (m) del nudo i. */
export function memberActionAt(member: FrameMember, lengthM: number, result: MemberCaseResult, x: number): MemberAction {
  const [ni, vi, mi] = result.endForces as [number, number, number];
  const { px, qy } = result;
  const [ui, vti, ti, uj, vtj, tj] = result.displacements as [number, number, number, number, number, number];
  const xi = Math.min(1, Math.max(0, x / lengthM));
  const L = lengthM;
  const ei = member.elasticModulusKpa * member.inertiaM4;
  const ea = member.elasticModulusKpa * member.areaM2;
  const n1 = 1 - 3 * xi ** 2 + 2 * xi ** 3;
  const n2 = L * (xi - 2 * xi ** 2 + xi ** 3);
  const n3 = 3 * xi ** 2 - 2 * xi ** 3;
  const n4 = L * (-(xi ** 2) + xi ** 3);
  const at = xi * L;
  return {
    axial: -ni - px * at,
    shear: vi + qy * at,
    moment: -mi + vi * at + qy * at ** 2 / 2,
    u: ui + (uj - ui) * xi + px * at * (L - at) / (2 * ea),
    v: n1 * vti + n2 * ti + n3 * vtj + n4 * tj + qy * at ** 2 * (L - at) ** 2 / (24 * ei),
  };
}
