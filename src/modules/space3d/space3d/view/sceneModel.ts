/**
 * Adaptador puro de proyecto + análisis a geometría de escena.
 *
 * Todo lo que se dibuja se decide aquí, sin Three.js: el viewport recibe
 * números y no vuelve a interpretar el dominio. Eso permite comprobar en test
 * exactamente qué se muestra —la deformada, el lado de un diagrama, qué barra
 * entra en una planta— sin WebGL.
 *
 * Regla dura: la deformada y los diagramas sólo existen si hay un resultado
 * **vigente**. Un resultado obsoleto describe otra geometría, y dibujarlo
 * encima del modelo actual sería mentir con precisión de doce decimales.
 *
 * Convenciones de dibujo, las de ETABS/SAP2000:
 *
 *   · P (N), V2 (Vy), V3 (Vz), T, M2 (My) y M3 (Mz) en ejes locales 1-2-3;
 *   · el diagrama de momento se dibuja del lado traccionado: M3 positivo
 *     hacia −2 (bajo una viga) y M2 positivo hacia +3;
 *   · N, V2 y T se dibujan en el plano 1-2 y V3 en el 1-3;
 *   · una planta enseña lo que está en su nivel; un alzado, lo que está en
 *     el plano de su eje. El resto queda como contexto tenue y no se elige.
 */
import { buildMemberOrientation } from '../engine/orientation';
import { resolveSpace3DTarget } from '../engine/solver';
import { SPACE3D_SECTION_CATALOG, type Space3DSectionShape } from '../model/sectionLibrary';
import { SPACE3D_GRID_TOLERANCE, resolveSpace3DGrid } from '../model/grid';
import {
  Space3DGeometryError,
  type Space3DAnalysisResult,
  type Space3DFrameMember,
  type Space3DGridLine,
  type Space3DMemberStation,
  type Space3DOrientationBasis,
  type Space3DProjectV1,
  type Space3DStory,
  type Space3DVector,
} from '../model/types';
import { deriveSpace3DMemberAxialAction } from './resultSemantics';
import type { Space3DAnalysisState, Space3DSelection } from '../store/Space3DProjectContext';

export type Space3DResultMode =
  | 'model' | 'deformed' | 'axial' | 'shear' | 'shear3' | 'torsion' | 'moment2' | 'moment' | 'reactions';

/** Componente de esfuerzo de cada modo de diagrama. */
export type Space3DForceComponent = 'N' | 'Vy' | 'Vz' | 'T' | 'My' | 'Mz';

export const SPACE3D_RESULT_COMPONENT: Readonly<Partial<Record<Space3DResultMode, Space3DForceComponent>>> = Object.freeze({
  axial: 'N', shear: 'Vy', shear3: 'Vz', torsion: 'T', moment2: 'My', moment: 'Mz',
});

/** Rótulo ETABS de cada componente. */
export const SPACE3D_COMPONENT_SYMBOL: Readonly<Record<Space3DForceComponent, string>> = Object.freeze({
  N: 'P', Vy: 'V2', Vz: 'V3', T: 'T', My: 'M2', Mz: 'M3',
});

/** Qué parte del modelo se enseña: todo, una planta o un alzado. */
export type Space3DViewScope =
  | { readonly kind: '3d' }
  | { readonly kind: 'plan'; readonly storyId: string; readonly elevation: number }
  | { readonly kind: 'elevation'; readonly axis: 'x' | 'z'; readonly lineId: string; readonly coordinate: number };

export const SPACE3D_SCOPE_3D: Space3DViewScope = Object.freeze({ kind: '3d' });

interface Space3DSceneMemberResult {
  readonly mode: 'axial' | 'shear' | 'moment';
  readonly start: number;
  readonly end: number;
  readonly magnitude: number;
  readonly relative: number;
}

export interface Space3DSceneNode {
  readonly id: string;
  readonly position: Space3DVector;
  readonly restrained: boolean;
  readonly selected: boolean;
  /** Pertenece a la planta o al alzado activo (siempre en 3D). */
  readonly inScope?: boolean;
}

/** Perfil para dibujar la barra extruida, en metros. */
export interface Space3DSceneSection {
  /** Clave de caché de la geometría del perfil. */
  readonly key: string;
  readonly shape: Space3DSectionShape;
  /** Canto, sobre el eje local 2 (y). */
  readonly depth: number;
  /** Ancho, sobre el eje local 3 (z). */
  readonly width: number;
  /** Espesor de pared o de ala, si la forma lo tiene. */
  readonly thickness?: number;
  /** Espesor de alma de un perfil I. */
  readonly web?: number;
}

/** Diagrama de un esfuerzo a lo largo de la barra. */
export interface Space3DSceneDiagram {
  readonly component: Space3DForceComponent;
  /** Posiciones (m desde `i`) y valores, con saltos repetidos. */
  readonly stations: readonly { readonly x: number; readonly value: number }[];
  /** Dirección global en la que un valor POSITIVO se dibuja. */
  readonly direction: Space3DVector;
  readonly maxAbs: number;
  /** Estación del mayor valor absoluto. */
  readonly peak: { readonly x: number; readonly value: number };
}

export interface Space3DSceneMember {
  readonly id: string;
  readonly nodeI: string;
  readonly nodeJ: string;
  readonly start: Space3DVector;
  readonly end: Space3DVector;
  readonly midpoint: Space3DVector;
  readonly length: number;
  readonly basis: Space3DOrientationBasis | null;
  readonly selected: boolean;
  readonly result: Space3DSceneMemberResult | null;
  readonly inScope?: boolean;
  readonly kind?: 'frame' | 'truss' | 'rigid';
  /** Columna (vertical), viga (horizontal) o riostra. */
  readonly role?: 'column' | 'beam' | 'brace';
  readonly section?: Space3DSceneSection;
  /** Extremos con la flexión liberada (rótula dibujada). */
  readonly hinges?: { readonly i: boolean; readonly j: boolean };
  readonly diagram?: Space3DSceneDiagram | null;
}

export interface Space3DSceneReaction {
  readonly nodeId: string;
  readonly origin: Space3DVector;
  readonly direction: Space3DVector;
  readonly magnitude: number;
  readonly relative: number;
}

export interface Space3DSceneSupport {
  readonly nodeId: string;
  readonly position: Space3DVector;
  readonly translations: readonly [boolean, boolean, boolean];
  readonly rotations: readonly [boolean, boolean, boolean];
  readonly fullyFixed: boolean;
}

export interface Space3DSceneLoad {
  readonly id: string;
  readonly nodeId: string;
  readonly kind: 'force' | 'moment';
  readonly origin: Space3DVector;
  readonly direction: Space3DVector;
  readonly magnitude: number;
  /** Magnitud relativa a la mayor carga del mismo tipo, en `(0, 1]`. */
  readonly relative: number;
}

/** Carga en barra ya resuelta a puntos del espacio para dibujarla. */
export interface Space3DSceneMemberLoad {
  readonly id: string;
  readonly memberId: string;
  readonly kind: 'distributed' | 'point' | 'moment';
  /** Puntos de aplicación sobre la barra y su intensidad global. */
  readonly points: readonly { readonly position: Space3DVector; readonly vector: Space3DVector }[];
  /** Intensidad de referencia (kN/m, kN o kN·m) para el rótulo. */
  readonly magnitude: number;
  readonly relative: number;
  /** Tramo relativo y extremos globales de una distribuida, para sumar tramos. */
  readonly span?: { readonly a: number; readonly b: number; readonly q1: Space3DVector; readonly q2: Space3DVector };
}

export interface Space3DSceneLocalAxes {
  readonly memberId: string;
  readonly origin: Space3DVector;
  readonly basis: Space3DOrientationBasis;
  readonly length: number;
}

export interface Space3DSceneDeformed {
  readonly scale: number;
  readonly maxDisplacement: number;
  readonly nodes: readonly { readonly id: string; readonly position: Space3DVector }[];
  readonly members: readonly { readonly id: string; readonly start: Space3DVector; readonly end: Space3DVector; readonly points?: readonly Space3DVector[] }[];
}

export interface Space3DSceneBounds {
  readonly min: Space3DVector;
  readonly max: Space3DVector;
  readonly center: Space3DVector;
  readonly span: number;
}

/** Rejilla visible: ejes, niveles y el plano donde se dibujan los ejes. */
export interface Space3DSceneGrid {
  readonly xLines: readonly Space3DGridLine[];
  readonly zLines: readonly Space3DGridLine[];
  readonly stories: readonly Space3DStory[];
  /** Elevación donde se dibujan los ejes (planta activa o base). */
  readonly elevation: number;
  readonly automatic: boolean;
}

export type Space3DSceneDiagnostic =
  | { readonly code: 'unresolved-member-endpoint'; readonly entityId: string }
  | { readonly code: 'degenerate-member'; readonly entityId: string }
  | { readonly code: 'invalid-node-coordinate'; readonly entityId: string };

export interface Space3DSceneModel {
  readonly nodes: readonly Space3DSceneNode[];
  readonly members: readonly Space3DSceneMember[];
  readonly supports: readonly Space3DSceneSupport[];
  readonly loads: readonly Space3DSceneLoad[];
  readonly memberLoads?: readonly Space3DSceneMemberLoad[];
  readonly reactions: readonly Space3DSceneReaction[];
  readonly localAxes: Space3DSceneLocalAxes | null;
  readonly deformed: Space3DSceneDeformed | null;
  readonly bounds: Space3DSceneBounds;
  readonly diagnostics: readonly Space3DSceneDiagnostic[];
  readonly isEmpty: boolean;
  readonly scope?: Space3DViewScope;
  readonly grid?: Space3DSceneGrid | null;
  /** Diagrama activo: componente, escala (m por unidad) y máximo global. */
  readonly diagram?: { readonly component: Space3DForceComponent; readonly scale: number; readonly maxAbs: number } | null;
}

interface Space3DSceneInput {
  readonly project: Space3DProjectV1;
  readonly analysis: Space3DAnalysisResult | null;
  readonly analysisState: Space3DAnalysisState;
  readonly selection: Space3DSelection | null;
  /** Selección múltiple; se suma a `selection`. */
  readonly selectedIds?: { readonly nodes: ReadonlySet<string>; readonly members: ReadonlySet<string> };
  readonly targetId: string;
  /** Escala explícita de la deformada; si falta se calcula para ocupar el 8 % del modelo. */
  readonly deformationScale?: number;
  readonly resultMode?: Space3DResultMode;
  readonly scope?: Space3DViewScope;
  /** Multiplicador de la altura de los diagramas sobre la automática. */
  readonly diagramFactor?: number;
  /**
   * Forma nodal a dibujar como deformada en lugar del análisis estático (un
   * modo de vibración o de pandeo), ya normalizada.
   */
  readonly shape?: readonly { readonly nodeId: string; readonly ux: number; readonly uy: number; readonly uz: number; readonly rx: number; readonly ry: number; readonly rz: number }[] | null;
}

const DEFAULT_SPAN = 6;
const DEFORMED_FRACTION = 0.08;
const DIAGRAM_FRACTION = 0.1;

const point = (x: number, y: number, z: number): Space3DVector => Object.freeze([x, y, z] as const);

const boundsOf = (positions: readonly Space3DVector[]): Space3DSceneBounds => {
  if (positions.length === 0) {
    return Object.freeze({
      min: point(0, 0, 0), max: point(0, 0, 0), center: point(0, 0, 0), span: DEFAULT_SPAN,
    });
  }
  const min: [number, number, number] = [positions[0][0], positions[0][1], positions[0][2]];
  const max: [number, number, number] = [...min];
  for (const position of positions) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  }
  const extents = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return Object.freeze({
    min: point(min[0], min[1], min[2]),
    max: point(max[0], max[1], max[2]),
    center: point((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2),
    span: Math.max(...extents, 1),
  });
};

const normalizeOrZero = (vector: Space3DVector): Space3DVector => {
  const length = Math.hypot(...vector);
  return length === 0 ? point(0, 0, 0) : point(vector[0] / length, vector[1] / length, vector[2] / length);
};

const add = (a: Space3DVector, b: Space3DVector, scale = 1): Space3DVector => point(a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale);
const lerp = (a: Space3DVector, b: Space3DVector, t: number): Space3DVector => point(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
const toGlobal = (basis: Space3DOrientationBasis, local: readonly [number, number, number]): Space3DVector => point(
  basis.x[0] * local[0] + basis.y[0] * local[1] + basis.z[0] * local[2],
  basis.x[1] * local[0] + basis.y[1] * local[1] + basis.z[1] * local[2],
  basis.x[2] * local[0] + basis.y[2] * local[1] + basis.z[2] * local[2],
);
const toLocal = (basis: Space3DOrientationBasis, vector: readonly [number, number, number]): [number, number, number] => [
  basis.x[0] * vector[0] + basis.x[1] * vector[1] + basis.x[2] * vector[2],
  basis.y[0] * vector[0] + basis.y[1] * vector[1] + basis.y[2] * vector[2],
  basis.z[0] * vector[0] + basis.z[1] * vector[1] + basis.z[2] * vector[2],
];

/** ¿Está el punto en el plano de la vista? */
const inScopePoint = (scope: Space3DViewScope, position: Space3DVector, tolerance: number): boolean => {
  if (scope.kind === '3d') return true;
  if (scope.kind === 'plan') return Math.abs(position[1] - scope.elevation) <= tolerance;
  return Math.abs(position[scope.axis === 'x' ? 0 : 2] - scope.coordinate) <= tolerance;
};

/**
 * Perfil de la barra: el del catálogo si lo es; si no, el rectángulo
 * equivalente de sus inercias (canto `√(12·Iz/A)`, ancho `√(12·Iy/A)`).
 */
const sectionOf = (member: Space3DFrameMember): Space3DSceneSection => {
  const catalog = member.sectionId ? SPACE3D_SECTION_CATALOG.find((item) => item.name === member.sectionId) : undefined;
  if (catalog && catalog.depth && catalog.width) {
    const depth = catalog.depth;
    const width = catalog.width;
    if (catalog.shape === 'I') {
      return { key: `I:${depth}:${width}`, shape: 'I', depth, width, thickness: Math.max(0.006, depth * 0.06), web: Math.max(0.005, depth * 0.035) };
    }
    if (catalog.shape === 'box') return { key: `box:${depth}:${width}:${catalog.A}`, shape: 'box', depth, width, thickness: Math.max(0.003, catalog.A / (2 * (depth + width))) };
    if (catalog.shape === 'pipe') return { key: `pipe:${depth}:${catalog.A}`, shape: 'pipe', depth, width: depth, thickness: Math.max(0.002, catalog.A / (Math.PI * depth)) };
    return { key: `${catalog.shape}:${depth}:${width}`, shape: catalog.shape, depth, width };
  }
  const area = member.A > 0 ? member.A : 0.01;
  const clamp = (value: number) => Math.min(3, Math.max(0.03, value));
  const depth = clamp(member.Iz > 0 ? Math.sqrt(12 * member.Iz / area) : Math.sqrt(area));
  const width = clamp(member.Iy > 0 ? Math.sqrt(12 * member.Iy / area) : Math.sqrt(area));
  const key = `rect:${depth.toPrecision(4)}:${width.toPrecision(4)}`;
  return { key, shape: 'rect', depth: Number(depth.toPrecision(4)), width: Number(width.toPrecision(4)) };
};

const roleOf = (basis: Space3DOrientationBasis | null, start: Space3DVector, end: Space3DVector, length: number): 'column' | 'beam' | 'brace' => {
  const vertical = basis ? Math.abs(basis.x[1]) : Math.abs(end[1] - start[1]) / length;
  if (vertical > 0.995) return 'column';
  if (vertical < 0.02) return 'beam';
  return 'brace';
};

/** Lado donde se dibuja un valor positivo de cada componente, en ejes locales. */
const DIAGRAM_SIDE: Record<Space3DForceComponent, readonly [number, number, number]> = {
  N: [0, 1, 0],
  Vy: [0, 1, 0],
  T: [0, 1, 0],
  Mz: [0, -1, 0],
  Vz: [0, 0, 1],
  My: [0, 0, 1],
};

/** Normal de la vista hacia la cámara: la dirección que una vista plana no ve. */
const viewNormal = (scope: Space3DViewScope): Space3DVector | null => (scope.kind === 'plan' ? point(0, 1, 0)
  : scope.kind === 'elevation' ? (scope.axis === 'x' ? point(1, 0, 0) : point(0, 0, 1)) : null);

/**
 * En una planta o un alzado el diagrama se abate al plano de la vista, como en
 * ETABS: un momento de viga, vertical, se leería de canto en planta. Se
 * conserva el lado (el signo respecto a la normal) para que tracción y
 * compresión no se confundan al girarlo.
 */
const diagramDirection = (direction: Space3DVector, member: Space3DSceneMember, scope: Space3DViewScope): Space3DVector => {
  const normal = viewNormal(scope);
  if (!normal) return direction;
  const along = direction[0] * normal[0] + direction[1] * normal[1] + direction[2] * normal[2];
  const projected = point(direction[0] - along * normal[0], direction[1] - along * normal[1], direction[2] - along * normal[2]);
  if (Math.hypot(...projected) >= 0.5) return normalizeOrZero(projected);
  const axis = normalizeOrZero(point(member.end[0] - member.start[0], member.end[1] - member.start[1], member.end[2] - member.start[2]));
  const turned = point(
    normal[1] * axis[2] - normal[2] * axis[1],
    normal[2] * axis[0] - normal[0] * axis[2],
    normal[0] * axis[1] - normal[1] * axis[0],
  );
  const sign = along >= 0 ? 1 : -1;
  const unit = normalizeOrZero(turned);
  return point(unit[0] * sign, unit[1] * sign, unit[2] * sign);
};

/**
 * Estaciones de un resultado. Sin estaciones (resultados de otra versión del
 * motor) se reconstruye la variación lineal entre extremos.
 */
const stationsOf = (result: Space3DAnalysisResult['memberResults'][number]): readonly Space3DMemberStation[] => {
  if (result.stations && result.stations.length > 0) return result.stations;
  // En x = 0 el esfuerzo es el opuesto de la acción del nudo i; en x = L,
  // por equilibrio de toda la barra, la acción del nudo j tal cual.
  const { start, end } = result;
  return [
    { x: 0, N: -start.N, Vy: -start.Vy, Vz: -start.Vz, T: -start.T, My: -start.My, Mz: -start.Mz, u: 0, v: 0, w: 0 },
    { x: result.length, N: end.N, Vy: end.Vy, Vz: end.Vz, T: end.T, My: end.My, Mz: end.Mz, u: 0, v: 0, w: 0 },
  ];
};

/**
 * Umbral de ruido de un resultado: por debajo, un esfuerzo es cero. Se ata a
 * la mayor fuerza de extremo del análisis (kN y kN·m comparten el orden de
 * magnitud en las unidades internas de un marco de edificio).
 */
export const space3DResultNoiseFloor = (analysis: Space3DAnalysisResult | null): number => {
  if (!analysis?.success) return 0;
  let reference = 0;
  for (const member of analysis.memberResults) {
    for (const end of [member.start, member.end]) {
      reference = Math.max(reference, Math.abs(end.N), Math.abs(end.Vy), Math.abs(end.Vz), Math.abs(end.T), Math.abs(end.My), Math.abs(end.Mz));
    }
  }
  return reference * 1e-9;
};

export const buildSpace3DSceneModel = (input: Space3DSceneInput): Space3DSceneModel => {
  const { project, analysis, analysisState, selection, targetId, deformationScale, resultMode = 'model' } = input;
  const scope = input.scope ?? SPACE3D_SCOPE_3D;
  const diagnostics: Space3DSceneDiagnostic[] = [];
  const isSelectedNode = (id: string) => (selection?.kind === 'node' && selection.id === id) || (input.selectedIds?.nodes.has(id) ?? false);
  const isSelectedMember = (id: string) => (selection?.kind === 'member' && selection.id === id) || (input.selectedIds?.members.has(id) ?? false);

  const component = SPACE3D_RESULT_COMPONENT[resultMode] ?? null;
  const colorKind: Space3DSceneMemberResult['mode'] | null = component === 'N' ? 'axial'
    : component === 'Vy' || component === 'Vz' ? 'shear'
      : component ? 'moment' : null;
  const resultIsCurrent = analysisState === 'ready' && analysis?.success === true;
  const memberResultById = new Map((resultIsCurrent ? analysis.memberResults : []).map((item) => [item.memberId, item] as const));

  const nodes: Space3DSceneNode[] = [];
  const positionById = new Map<string, Space3DVector>();
  const tolerance = SPACE3D_GRID_TOLERANCE * 10;
  for (const node of project.nodes) {
    if (![node.x, node.y, node.z].every(Number.isFinite)) {
      diagnostics.push(Object.freeze({ code: 'invalid-node-coordinate', entityId: node.id }));
      continue;
    }
    const position = point(node.x, node.y, node.z);
    positionById.set(node.id, position);
    const restraints = node.restraints;
    nodes.push(Object.freeze({
      id: node.id,
      position,
      restrained: restraints.ux || restraints.uy || restraints.uz || restraints.rx || restraints.ry || restraints.rz,
      selected: isSelectedNode(node.id),
      inScope: inScopePoint(scope, position, tolerance),
    }));
  }

  // Primero la magnitud por barra y su máximo, para la escala común. Lo que
  // queda por debajo del ruido de redondeo del propio análisis es cero: un
  // momento de 1e-16 kN·m en un pórtico cargado sólo axialmente no es un
  // diagrama, y escalarlo al tamaño de la pantalla sería inventarlo.
  const rawResults = new Map<string, { start: number; end: number; magnitude: number; stations: readonly Space3DMemberStation[] }>();
  if (component) {
    const noise = space3DResultNoiseFloor(analysis);
    for (const [memberId, item] of memberResultById) {
      const stations = stationsOf(item).map((station) => ({ ...station, [component]: Math.abs(station[component]) <= noise ? 0 : station[component] }));
      const values = stations.map((station) => station[component]);
      const magnitude = Math.max(...values.map(Math.abs), 0);
      const start = component === 'N' ? deriveSpace3DMemberAxialAction(item) : values[0] ?? 0;
      const end = component === 'N' ? start : values[values.length - 1] ?? 0;
      rawResults.set(memberId, { start, end, magnitude, stations });
    }
  }

  const members: Space3DSceneMember[] = [];
  for (const member of project.members) {
    const start = positionById.get(member.i);
    const end = positionById.get(member.j);
    if (!start || !end) {
      diagnostics.push(Object.freeze({ code: 'unresolved-member-endpoint', entityId: member.id }));
      continue;
    }
    const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    if (length === 0) {
      diagnostics.push(Object.freeze({ code: 'degenerate-member', entityId: member.id }));
      continue;
    }
    let basis: Space3DOrientationBasis | null = null;
    try {
      basis = buildMemberOrientation(start, end, member.orientation);
    } catch (error) {
      if (!(error instanceof Space3DGeometryError)) throw error;
      basis = null;
    }
    const releases = member.releases;
    members.push({
      id: member.id,
      nodeI: member.i,
      nodeJ: member.j,
      start,
      end,
      midpoint: point((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2),
      length,
      basis,
      selected: isSelectedMember(member.id),
      result: null,
      inScope: inScopePoint(scope, start, tolerance) && inScopePoint(scope, end, tolerance),
      kind: member.type ?? 'frame',
      role: roleOf(basis, start, end, length),
      section: sectionOf(member),
      hinges: {
        i: member.type === 'truss' || Boolean(releases?.iRy || releases?.iRz),
        j: member.type === 'truss' || Boolean(releases?.jRy || releases?.jRz),
      },
      diagram: null,
    });
  }

  // La escala del diagrama la fija el mayor valor de lo que se ve.
  const visibleMax = Math.max(0, ...members.filter((member) => member.inScope).map((member) => rawResults.get(member.id)?.magnitude ?? 0));
  const maxMemberResult = Math.max(0, ...[...rawResults.values()].map((item) => item.magnitude));
  const bounds = boundsOf(nodes.map((node) => node.position));
  const diagramScale = visibleMax > 0 ? (bounds.span * DIAGRAM_FRACTION * (input.diagramFactor ?? 1)) / visibleMax : 0;

  const finalMembers: Space3DSceneMember[] = members.map((member) => {
    const raw = rawResults.get(member.id);
    if (!raw || !component || !colorKind) return Object.freeze(member);
    const side = DIAGRAM_SIDE[component];
    const direction = diagramDirection(member.basis ? toGlobal(member.basis, side) : point(0, 1, 0), member, scope);
    const stations = raw.stations.map((station) => ({ x: station.x, value: station[component] }));
    const peak = stations.reduce((best, station) => (Math.abs(station.value) > Math.abs(best.value) ? station : best), stations[0] ?? { x: 0, value: 0 });
    return Object.freeze({
      ...member,
      result: Object.freeze({
        mode: colorKind,
        start: raw.start,
        end: raw.end,
        magnitude: raw.magnitude,
        relative: maxMemberResult > 0 ? raw.magnitude / maxMemberResult : 0,
      }),
      diagram: Object.freeze({ component, stations, direction, maxAbs: raw.magnitude, peak }),
    });
  });

  const supports: Space3DSceneSupport[] = project.nodes
    .filter((node) => positionById.has(node.id))
    .filter((node) => Object.values(node.restraints).some(Boolean))
    .map((node) => Object.freeze({
      nodeId: node.id,
      position: positionById.get(node.id)!,
      translations: Object.freeze([node.restraints.ux, node.restraints.uy, node.restraints.uz] as const),
      rotations: Object.freeze([node.restraints.rx, node.restraints.ry, node.restraints.rz] as const),
      fullyFixed: Object.values(node.restraints).every(Boolean),
    }));

  const target = resolveSpace3DTarget(project, targetId);
  const rawLoads = project.nodalLoads
    .filter((load) => positionById.has(load.nodeId))
    .flatMap((load) => {
      const factor = target?.factors.get(load.caseId) ?? 0;
      if (factor === 0) return [];
      const force: Space3DVector = point(load.fx * factor, load.fy * factor, load.fz * factor);
      const moment: Space3DVector = point(load.mx * factor, load.my * factor, load.mz * factor);
      const entries: { kind: 'force' | 'moment'; vector: Space3DVector; id: string; nodeId: string }[] = [];
      if (Math.hypot(...force) > 0) entries.push({ kind: 'force', vector: force, id: load.id, nodeId: load.nodeId });
      if (Math.hypot(...moment) > 0) entries.push({ kind: 'moment', vector: moment, id: load.id, nodeId: load.nodeId });
      return entries;
    });

  const maxForce = Math.max(...rawLoads.filter((item) => item.kind === 'force').map((item) => Math.hypot(...item.vector)), 0);
  const maxMoment = Math.max(...rawLoads.filter((item) => item.kind === 'moment').map((item) => Math.hypot(...item.vector)), 0);

  const loads: Space3DSceneLoad[] = rawLoads.map((item) => {
    const magnitude = Math.hypot(...item.vector);
    const reference = item.kind === 'force' ? maxForce : maxMoment;
    return Object.freeze({
      id: item.id,
      nodeId: item.nodeId,
      kind: item.kind,
      origin: positionById.get(item.nodeId)!,
      direction: normalizeOrZero(item.vector),
      magnitude,
      relative: reference > 0 ? magnitude / reference : 1,
    });
  });

  const memberLoads = buildMemberLoads(project, finalMembers, target?.factors ?? new Map());

  const rawReactions = resultIsCurrent && resultMode === 'reactions'
    ? analysis.nodeResults.flatMap((item) => {
      const origin = positionById.get(item.nodeId);
      if (!origin) return [];
      const vector = point(item.reaction.ux, item.reaction.uy, item.reaction.uz);
      const magnitude = Math.hypot(...vector);
      return magnitude > 0 ? [{ nodeId: item.nodeId, origin, vector, magnitude }] : [];
    })
    : [];
  const maxReaction = Math.max(...rawReactions.map((item) => item.magnitude), 0);
  const reactions: Space3DSceneReaction[] = rawReactions.map((item) => Object.freeze({
    nodeId: item.nodeId,
    origin: item.origin,
    direction: normalizeOrZero(item.vector),
    magnitude: item.magnitude,
    relative: maxReaction > 0 ? item.magnitude / maxReaction : 0,
  }));

  const selectedMember = selection?.kind === 'member'
    ? finalMembers.find((member) => member.id === selection.id)
    : undefined;
  const localAxes: Space3DSceneLocalAxes | null = selectedMember?.basis
    ? Object.freeze({
      memberId: selectedMember.id,
      origin: selectedMember.midpoint,
      basis: selectedMember.basis,
      length: Math.min(selectedMember.length * 0.32, bounds.span * 0.22),
    })
    : null;

  const deformed = input.shape
    ? buildShapeDeformed(input.shape, finalMembers, positionById, bounds, deformationScale)
    : buildDeformed({ analysis, analysisState, members: finalMembers, positionById, bounds, deformationScale });

  const resolvedGrid = resolveSpace3DGrid(project);
  const grid: Space3DSceneGrid | null = resolvedGrid.xLines.length + resolvedGrid.zLines.length + resolvedGrid.stories.length > 0
    ? Object.freeze({
      xLines: resolvedGrid.xLines,
      zLines: resolvedGrid.zLines,
      stories: resolvedGrid.stories,
      elevation: scope.kind === 'plan' ? scope.elevation : (resolvedGrid.stories[0]?.elevation ?? bounds.min[1]),
      automatic: resolvedGrid.automatic,
    })
    : null;

  return Object.freeze({
    nodes: Object.freeze(nodes),
    members: Object.freeze(finalMembers),
    supports: Object.freeze(supports),
    loads: Object.freeze(loads),
    memberLoads: Object.freeze(memberLoads),
    reactions: Object.freeze(reactions),
    localAxes,
    deformed,
    bounds,
    diagnostics: Object.freeze(diagnostics),
    isEmpty: nodes.length === 0,
    scope,
    grid,
    diagram: component && diagramScale > 0 ? Object.freeze({ component, scale: diagramScale, maxAbs: visibleMax }) : null,
  });
};

/**
 * Cargas en barra del objetivo, como puntos con su intensidad global. Una
 * distribuida se muestrea en su tramo para dibujar la fila de flechas.
 */
const buildMemberLoads = (
  project: Space3DProjectV1,
  members: readonly Space3DSceneMember[],
  factors: ReadonlyMap<string, number>,
): Space3DSceneMemberLoad[] => {
  const byId = new Map(members.map((member) => [member.id, member]));
  const raw: Omit<Space3DSceneMemberLoad, 'relative'>[] = [];
  for (const load of project.memberLoads) {
    const factor = factors.get(load.caseId) ?? 0;
    const member = byId.get(load.memberId);
    if (factor === 0 || !member || !member.basis) continue;
    const orient = (vector: readonly [number, number, number]): Space3DVector => (load.coordinateSystem === 'local' ? toGlobal(member.basis!, vector) : point(...vector));
    if (load.type === 'distributed') {
      const q1 = orient([(load.qxStart ?? 0) * factor, (load.qyStart ?? 0) * factor, (load.qzStart ?? 0) * factor]);
      const q2 = orient([(load.qxEnd ?? 0) * factor, (load.qyEnd ?? 0) * factor, (load.qzEnd ?? 0) * factor]);
      const a = Math.min(load.start, load.end);
      const b = Math.max(load.start, load.end);
      const count = Math.max(2, Math.min(9, Math.round((b - a) * 8) + 1));
      const points = Array.from({ length: count }, (_, index) => {
        const t = count === 1 ? 0 : index / (count - 1);
        return { position: lerp(member.start, member.end, a + (b - a) * t), vector: lerp(q1, q2, t) };
      });
      raw.push({ id: load.id, memberId: member.id, kind: 'distributed', points, magnitude: Math.max(Math.hypot(...q1), Math.hypot(...q2)), span: { a, b, q1, q2 } });
    } else if (load.type === 'point') {
      const vector = orient([(load.px ?? 0) * factor, (load.py ?? 0) * factor, (load.pz ?? 0) * factor]);
      raw.push({ id: load.id, memberId: member.id, kind: 'point', points: [{ position: lerp(member.start, member.end, load.position ?? 0.5), vector }], magnitude: Math.hypot(...vector) });
    } else {
      const vector = orient([(load.mx ?? 0) * factor, (load.my ?? 0) * factor, ((load.mz ?? 0) + (load.moment ?? 0)) * factor]);
      raw.push({ id: load.id, memberId: member.id, kind: 'moment', points: [{ position: lerp(member.start, member.end, load.position ?? 0.5), vector }], magnitude: Math.hypot(...vector) });
    }
  }
  const maxByKind = new Map<string, number>();
  for (const item of raw) maxByKind.set(item.kind, Math.max(maxByKind.get(item.kind) ?? 0, item.magnitude));
  return raw.filter((item) => item.magnitude > 0).map((item) => Object.freeze({
    ...item,
    relative: (maxByKind.get(item.kind) ?? 0) > 0 ? item.magnitude / maxByKind.get(item.kind)! : 1,
  }));
};

/**
 * Deformada desde las estaciones: la elástica local de cada barra, llevada a
 * global y escalada. Si las estaciones faltan, la recta entre nudos.
 */
const buildDeformed = ({
  analysis, analysisState, members, positionById, bounds, deformationScale,
}: {
  analysis: Space3DAnalysisResult | null;
  analysisState: Space3DAnalysisState;
  members: readonly Space3DSceneMember[];
  positionById: ReadonlyMap<string, Space3DVector>;
  bounds: Space3DSceneBounds;
  deformationScale: number | undefined;
}): Space3DSceneDeformed | null => {
  if (analysisState !== 'ready' || !analysis?.success || analysis.nodeResults.length === 0) return null;

  let maxDisplacement = 0;
  for (const result of analysis.nodeResults) {
    const { ux, uy, uz } = result.displacement;
    if (![ux, uy, uz].every(Number.isFinite)) return null;
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(ux, uy, uz));
  }
  const memberResults = new Map(analysis.memberResults.map((item) => [item.memberId, item]));
  for (const result of analysis.memberResults) {
    if (!result.basis) continue;
    for (const station of result.stations ?? []) {
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(station.u, station.v, station.w));
    }
  }

  // La deformada real de una estructura de servicio es invisible a escala 1:1.
  // Se amplifica hasta ocupar una fracción fija del modelo, y la escala se
  // publica para que la interfaz pueda decir por cuánto está multiplicada.
  const scale = deformationScale ?? (maxDisplacement > 0 ? (bounds.span * DEFORMED_FRACTION) / maxDisplacement : 1);

  const displaced = new Map<string, Space3DVector>();
  for (const result of analysis.nodeResults) {
    const base = positionById.get(result.nodeId);
    if (!base) continue;
    displaced.set(result.nodeId, point(
      base[0] + scale * result.displacement.ux,
      base[1] + scale * result.displacement.uy,
      base[2] + scale * result.displacement.uz,
    ));
  }

  const deformedMembers = members.flatMap((member) => {
    const start = displaced.get(member.nodeI);
    const end = displaced.get(member.nodeJ);
    if (!start || !end) return [];
    const result = memberResults.get(member.id);
    const stations = result?.stations;
    const points = stations && stations.length > 1 && member.basis
      ? stations.filter((station, index) => index === 0 || station.x !== stations[index - 1].x).map((station) => {
        const along = lerp(member.start, member.end, member.length > 0 ? station.x / member.length : 0);
        return add(along, toGlobal(member.basis!, [station.u, station.v, station.w]), scale);
      })
      : undefined;
    return [Object.freeze({ id: member.id, start, end, ...(points ? { points: Object.freeze(points) } : {}) })];
  });

  return Object.freeze({
    scale,
    maxDisplacement,
    nodes: Object.freeze([...displaced].map(([id, position]) => Object.freeze({ id, position }))),
    members: Object.freeze(deformedMembers),
  });
};

/**
 * Forma nodal (modo propio o de pandeo) interpolada con Hermite en cada
 * barra: traslaciones y giros de sus extremos en ejes locales.
 */
const buildShapeDeformed = (
  shape: NonNullable<Space3DSceneInput['shape']>,
  members: readonly Space3DSceneMember[],
  positionById: ReadonlyMap<string, Space3DVector>,
  bounds: Space3DSceneBounds,
  deformationScale: number | undefined,
): Space3DSceneDeformed | null => {
  const byNode = new Map(shape.map((item) => [item.nodeId, item]));
  const maxDisplacement = Math.max(0, ...shape.map((item) => Math.hypot(item.ux, item.uy, item.uz)));
  if (!(maxDisplacement > 0)) return null;
  const scale = deformationScale ?? (bounds.span * DEFORMED_FRACTION * 1.5) / maxDisplacement;
  const displaced = new Map<string, Space3DVector>();
  for (const [nodeId, base] of positionById) {
    const value = byNode.get(nodeId);
    displaced.set(nodeId, value ? point(base[0] + scale * value.ux, base[1] + scale * value.uy, base[2] + scale * value.uz) : base);
  }
  const SEGMENTS = 10;
  const deformedMembers = members.flatMap((member) => {
    const start = displaced.get(member.nodeI);
    const end = displaced.get(member.nodeJ);
    const a = byNode.get(member.nodeI);
    const b = byNode.get(member.nodeJ);
    if (!start || !end) return [];
    if (!a || !b || !member.basis || member.kind === 'truss') return [Object.freeze({ id: member.id, start, end })];
    const L = member.length;
    const [ua, va, wa] = toLocal(member.basis, [a.ux, a.uy, a.uz]);
    const [, rya, rza] = toLocal(member.basis, [a.rx, a.ry, a.rz]);
    const [ub, vb, wb] = toLocal(member.basis, [b.ux, b.uy, b.uz]);
    const [, ryb, rzb] = toLocal(member.basis, [b.rx, b.ry, b.rz]);
    const points = Array.from({ length: SEGMENTS + 1 }, (_, index) => {
      const xi = index / SEGMENTS;
      const n1 = 1 - 3 * xi ** 2 + 2 * xi ** 3;
      const n2 = L * (xi - 2 * xi ** 2 + xi ** 3);
      const n3 = 3 * xi ** 2 - 2 * xi ** 3;
      const n4 = L * (-(xi ** 2) + xi ** 3);
      const u = ua + (ub - ua) * xi;
      const v = n1 * va + n2 * rza + n3 * vb + n4 * rzb;
      const w = n1 * wa - n2 * rya + n3 * wb - n4 * ryb;
      return add(lerp(member.start, member.end, xi), toGlobal(member.basis!, [u, v, w]), scale);
    });
    return [Object.freeze({ id: member.id, start, end, points: Object.freeze(points) })];
  });
  return Object.freeze({
    scale,
    maxDisplacement,
    nodes: Object.freeze([...displaced].map(([id, position]) => Object.freeze({ id, position }))),
    members: Object.freeze(deformedMembers),
  });
};
