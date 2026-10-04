import {
  probeLoads,
  type ExternalStructureAxes, type ExternalStructureSource, type StructureAction, type StructureAnalysisOutcome, type StructureCase, type StructureCaseResult, type StructureMember, type StructureNode,
  type StructureSource, type StructureSupport,
} from '../design/elements/structure';
import { buildMemberOrientation } from '../modules/space3d/space3d/engine/orientation';
import { multiplyMatrixVector } from '../foundation/linearAlgebra';
import { recoverMemberEndDisplacements } from '../modules/space3d/space3d/engine/element';
import { computeSpace3DMemberStations, EMPTY_LOCAL_LOADS } from '../modules/space3d/space3d/engine/memberLoading';
import {
  analyzeSpace3DProject, assembleSpace3DSkylineStiffness, assembleSpace3DStaticModel, space3DMechanismIssue,
  type Space3DStaticAssembly, type Space3DStaticAssemblyElement,
} from '../modules/space3d/space3d/engine/solver';
import { expandSpace3DVector, reduceSpace3DVector } from '../modules/space3d/space3d/engine/equations';
import { factorizeSkyline, Space3DSingularMatrixError, type Space3DSkylineFactorization } from '../modules/space3d/space3d/engine/skylineSolver';
import { resolveSpace3DGrid } from '../modules/space3d/space3d/model/grid';
import { SPACE3D_MATERIALS } from '../modules/space3d/space3d/model/sectionLibrary';
import type {
  Space3DAnalysisIssue, Space3DFrameMember, Space3DLoadCase, Space3DMemberStation, Space3DNode, Space3DNodeResult, Space3DProjectV1, Space3DVector,
} from '../modules/space3d/space3d/model/types';

/**
 * Puente declarado Modelo 3D → Diseño (modos de FStructure).
 *
 * El taller diseña estructuras planas; del 3D se diseña un **eje**: el pórtico
 * contenido en un plano vertical x = cte (ejes A, B…) o z = cte (ejes 1, 2…).
 * Lo usa sólo la mesa (`src/features/workspace`) y el modelo no se modifica.
 *
 * - **Acciones del modelo completo.** Cada caso se resuelve con todo el 3D
 *   (vigas transversales, diafragmas, los demás ejes), así las cargas que bajan
 *   por las vigas que llegan al eje sí llegan a sus columnas. Del resultado se
 *   leen las acciones en el plano del eje: axial, cortante y momento de flexión
 *   en el plano; las columnas también reciben la flexión perpendicular (y su
 *   cortante) para revisarse en flexión biaxial, y las vigas su torsor, que se
 *   compara con el umbral de agrietamiento (su diseño no se implementa).
 * - **Casos por categoría**, como el Modelo 2D: permanente → muerta, variable →
 *   viva partida por barra cargada del eje (el resto del caso va junto) para
 *   alternarla, accidental → lateral. Inactivos y «otro» no entran.
 * - **Sondeo lateral con el eje solo.** La rigidez de entrepiso para el índice
 *   de estabilidad sale del pórtico del eje aislado (fuera del plano
 *   restringido), coherente con las cargas verticales de sus propias columnas.
 *
 * Ejes del plano: (s, y) con s = x en los ejes z = cte y s = z en los x = cte;
 * el giro en el plano es alrededor de n = s × y. En cada barra la dirección
 * transversal del 2D es n × x_local, y la flexión en el plano es la del eje
 * local (y o z) que la contiene.
 */

export interface Space3DFramePlane {
  /** `z:0`, `x:5`. */
  readonly id: string;
  readonly axis: 'x' | 'z';
  readonly coordinate: number;
  /** «Eje 1 · z = 0 m». */
  readonly label: string;
  /** Rótulo de la rejilla («1», «A»), si el plano coincide con uno de sus ejes. */
  readonly short: string | null;
  readonly members: number;
}

type PlaneAxis = Space3DFramePlane['axis'];

const PLANE_TOLERANCE = 1e-3;
const CONCRETE_E_RANGE_KPA = [15e6, 50e6] as const;
const PROBE_CASE = 'design§probe';
const STATION_SEGMENTS = 24;

const keyOf = (value: number) => Math.round(value / PLANE_TOLERANCE) * PLANE_TOLERANCE;
const metres = (value: number) => `${Number(value.toFixed(2))} m`;
const coordinateOf = (node: Space3DNode, axis: PlaneAxis) => axis === 'z' ? node.z : node.x;
const onPlane = (node: Space3DNode, axis: PlaneAxis, coordinate: number) => Math.abs(coordinateOf(node, axis) - coordinate) <= PLANE_TOLERANCE;
/** Coordenada horizontal del plano: x en los ejes z = cte, z en los x = cte. */
const inPlaneOf = (node: Space3DNode, axis: PlaneAxis) => axis === 'z' ? node.x : node.z;
/** Normal del plano que hace diestro a (s, y). */
const normalOf = (axis: PlaneAxis): Space3DVector => axis === 'z' ? [0, 0, 1] : [-1, 0, 0];

const cross = (a: Space3DVector, b: Space3DVector): Space3DVector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Space3DVector, b: Space3DVector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const parsePlaneId = (id: string): { axis: PlaneAxis; coordinate: number } | null => {
  const match = /^(x|z):(-?\d+(?:\.\d+)?(?:e-?\d+)?)$/.exec(id);
  return match ? { axis: match[1] as PlaneAxis, coordinate: Number(match[2]) } : null;
};

/**
 * Los ejes del Modelo 3D que se pueden diseñar: planos verticales con al menos
 * una barra horizontal en el plano (una viga del pórtico). Primero los z = cte
 * (ejes 1, 2…) y luego los x = cte (A, B…), cada grupo en orden.
 */
export function space3dFramePlanes(model: Space3DProjectV1): Space3DFramePlane[] {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const grid = resolveSpace3DGrid(model);
  const planes: Space3DFramePlane[] = [];
  for (const axis of ['z', 'x'] as const) {
    const candidates = new Map<number, number>();
    for (const member of model.members) {
      const a = nodes.get(member.i);
      const b = nodes.get(member.j);
      if (!a || !b || Math.abs(coordinateOf(a, axis) - coordinateOf(b, axis)) > PLANE_TOLERANCE) continue;
      // Una viga del eje recorre la dirección horizontal del plano.
      if (Math.abs(inPlaneOf(b, axis) - inPlaneOf(a, axis)) <= PLANE_TOLERANCE) continue;
      const key = keyOf(coordinateOf(a, axis));
      candidates.set(key, 0);
    }
    for (const coordinate of [...candidates.keys()].sort((a, b) => a - b)) {
      const count = model.members.filter((member) => {
        const a = nodes.get(member.i);
        const b = nodes.get(member.j);
        return a && b && onPlane(a, axis, coordinate) && onPlane(b, axis, coordinate);
      }).length;
      const line = (axis === 'z' ? grid.zLines : grid.xLines).find((item) => Math.abs(item.coordinate - coordinate) <= 5 * PLANE_TOLERANCE);
      const where = `${axis} = ${metres(coordinate)}`;
      planes.push({
        id: `${axis}:${Number(coordinate.toFixed(6))}`,
        axis,
        coordinate,
        label: line ? `Eje ${line.id} · ${where}` : where,
        short: line?.id ?? null,
        members: count,
      });
    }
  }
  return planes;
}

const supportOf = (node: Space3DNode, axis: PlaneAxis): StructureSupport => {
  const { restraints } = node;
  const along = axis === 'z' ? restraints.ux : restraints.uz;
  const rotation = axis === 'z' ? restraints.rz : restraints.rx;
  if (along && restraints.uy && rotation) return 'fixed';
  if (along && restraints.uy) return 'pinned';
  if (along || restraints.uy) return 'roller';
  return 'free';
};

const concreteOf = (member: Space3DFrameMember) => {
  const material = member.materialId ? SPACE3D_MATERIALS.find((item) => item.id === member.materialId) : undefined;
  if (material) {
    if (material.category !== 'concrete') return { concrete: false, fcMpa: null, name: material.name };
    const fc = /fc(\d+(?:\.\d+)?)/.exec(material.id);
    return { concrete: true, fcMpa: fc ? Number(fc[1]) : null };
  }
  // Concreto traído del 2D con un f′c que el catálogo del 3D no tiene (`concrete-fc28`).
  const imported = member.materialId ? /^concrete-fc(\d+(?:\.\d+)?)$/.exec(member.materialId) : null;
  if (imported) return { concrete: true, fcMpa: Number(imported[1]) };
  return { concrete: member.E >= CONCRETE_E_RANGE_KPA[0] && member.E <= CONCRETE_E_RANGE_KPA[1], fcMpa: null };
};

/** Firma corta del modelo y del eje: cambia con cualquier dato que afecte el diseño. */
const revisionOf = (model: Space3DProjectV1, planeId: string) => {
  const text = JSON.stringify([planeId, model.nodes, model.members, model.loadCases, model.nodalLoads, model.memberLoads, model.diaphragms ?? [],
    model.prescribedDisplacements, model.memberInitialEffects, model.nodeLinks, model.multiPointConstraints, model.generatedLoadSources]);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `${model.id}:${(hash >>> 0).toString(36)}:${text.length}`;
};

const issueText = (issue: Space3DAnalysisIssue | undefined) => {
  if (!issue) return 'revisa apoyos y conexiones';
  if (issue.code === 'mechanism') return `es un mecanismo${issue.entityId ? ` en ${issue.entityId}${issue.field ? ` (${issue.field})` : ''}` : ''}: revisa apoyos y conexiones`;
  if (issue.code === 'unsupported-semantics') return `${issue.entityId || 'el modelo'} usa «${issue.field ?? issue.entityKind}», que el análisis estático todavía no resuelve`;
  return `${issue.code}${issue.entityId ? ` en ${issue.entityId}` : ''}`;
};

/** Barra del eje: cómo leer su flexión en el plano. */
interface PlaneMember {
  readonly source: Space3DFrameMember;
  /** Eje local que contiene la dirección transversal del plano. */
  readonly bending: 'y' | 'z';
  /** Signo entre la dirección transversal del 2D y ese eje local. */
  readonly sign: 1 | -1;
}

interface InPlaneStation {
  /** Flexión perpendicular al plano y su cortante (dM/dx), para las columnas. */
  readonly outMoment: number;
  readonly outShear: number;
  /** Torsor, kN·m. */
  readonly torsion: number;
  readonly x: number;
  readonly axial: number;
  readonly shear: number;
  readonly moment: number;
  readonly u: number;
  readonly v: number;
}

/** Acciones del 3D en los ejes del 2D (axial a tensión, V = dM/dx, M positivo con v'' > 0). */
const inPlaneStation = (station: Space3DMemberStation, member: PlaneMember): InPlaneStation => member.bending === 'y'
  ? {
    x: station.x, axial: station.N, shear: -member.sign * station.Vy, moment: member.sign * station.Mz, u: station.u, v: member.sign * station.v,
    outMoment: station.My, outShear: station.Vz, torsion: station.T,
  }
  : {
    x: station.x, axial: station.N, shear: -member.sign * station.Vz, moment: -member.sign * station.My, u: station.u, v: member.sign * station.w,
    outMoment: station.Mz, outShear: -station.Vy, torsion: station.T,
  };

const ZERO_ACTION: StructureAction = { axial: 0, shear: 0, moment: 0, u: 0, v: 0 };
const ZERO_END_FORCES: readonly number[] = Object.freeze(new Array<number>(12).fill(0));

/** Estaciones de una barra en los ejes del plano, con la elástica sin repetidos. */
interface MemberSamples {
  readonly length: number;
  readonly stations: readonly InPlaneStation[];
  readonly xs: readonly number[];
  readonly us: readonly number[];
  readonly vs: readonly number[];
}

const samplesOf = (length: number, stations: readonly InPlaneStation[]): MemberSamples => {
  const distinct = stations.filter((station, index) => index === 0 || station.x > stations[index - 1]!.x);
  return { length, stations, xs: distinct.map((item) => item.x), us: distinct.map((item) => item.u), vs: distinct.map((item) => item.v) };
};

/** Cúbica por las cuatro estaciones vecinas: la elástica es suave y no tiene saltos. */
const smooth = (xs: readonly number[], values: readonly number[], span: number, x: number) => {
  const count = Math.min(4, xs.length);
  const first = Math.min(Math.max(0, span - 1), xs.length - count);
  let total = 0;
  for (let a = first; a < first + count; a += 1) {
    let weight = 1;
    for (let b = first; b < first + count; b += 1) if (b !== a) weight *= (x - xs[b]!) / (xs[a]! - xs[b]!);
    total += weight * values[a]!;
  }
  return total;
};

/**
 * Valor a `x` entre estaciones: el momento con Hermite cúbico (su pendiente es
 * el cortante, exacto con cargas uniformes o lineales), la elástica con una
 * cúbica y lo demás lineal. En una carga concentrada vale el lado izquierdo,
 * salvo en el extremo i.
 */
const sampleStations = ({ length, stations, xs, us, vs }: MemberSamples, x: number): StructureAction => {
  if (!stations.length) return ZERO_ACTION;
  const at = Math.min(length, Math.max(0, x));
  let span = 0;
  while (span < xs.length - 2 && at > xs[span + 1]!) span += 1;
  const elastic = { u: smooth(xs, us, span, at), v: smooth(xs, vs, span, at) };
  for (let index = 0; index < stations.length - 1; index += 1) {
    const a = stations[index]!;
    const b = stations[index + 1]!;
    const h = b.x - a.x;
    if (!(h > 0) || at > b.x + 1e-12 || at < a.x - 1e-12) continue;
    const t = Math.min(1, Math.max(0, (at - a.x) / h));
    const linear = (p: number, q: number) => p + (q - p) * t;
    const t2 = t * t;
    const t3 = t2 * t;
    const hermite = (m0: number, v0: number, m1: number, v1: number) => (2 * t3 - 3 * t2 + 1) * m0 + (t3 - 2 * t2 + t) * h * v0 + (-2 * t3 + 3 * t2) * m1 + (t3 - t2) * h * v1;
    return {
      axial: linear(a.axial, b.axial), shear: linear(a.shear, b.shear), moment: hermite(a.moment, a.shear, b.moment, b.shear), ...elastic,
      outOfPlane: { moment: hermite(a.outMoment, a.outShear, b.outMoment, b.outShear), shear: linear(a.outShear, b.outShear) },
      torsion: linear(a.torsion, b.torsion),
    };
  }
  const last = stations.at(-1)!;
  return { axial: last.axial, shear: last.shear, moment: last.moment, ...elastic, outOfPlane: { moment: last.outMoment, shear: last.outShear }, torsion: last.torsion };
};

interface ProjectedCase {
  readonly case: StructureCase;
  readonly solverId: string;
}

export function space3dDesignSource(model: Space3DProjectV1, planeId: string): ExternalStructureSource {
  const errors: string[] = [];
  const notes: string[] = [];
  const parsed = parsePlaneId(planeId);
  const plane = parsed ? space3dFramePlanes(model).find((item) => item.axis === parsed.axis && Math.abs(item.coordinate - parsed.coordinate) <= PLANE_TOLERANCE) : undefined;
  const empty = { members: 0, beams: 0, columns: 0, skipped: 0, deadCases: 0, liveCases: 0, lateralCases: 0, ignoredCases: [] as string[] };
  if (!plane) {
    errors.push(!model.members.length
      ? 'El Modelo 3D está vacío: modela, genera o trae del 2D la estructura en el modo 3D.'
      : !space3dFramePlanes(model).length
        ? 'El Modelo 3D no tiene ejes con vigas que diseñar (pórticos en planos x = cte o z = cte).'
        : 'Ese eje ya no está en el Modelo 3D: elige otro.');
    return { label: model.name, revision: revisionOf(model, planeId), summary: empty, fcMpa: null, includesSelfWeight: false, errors, create: () => null };
  }
  const { axis, coordinate } = plane;
  // Ejes de la rejilla que cruzan este plano: los x = cte en un eje z = cte y al revés.
  const grid = resolveSpace3DGrid(model);
  const gridLines = axis === 'z' ? grid.xLines : grid.zLines;
  const normal = normalOf(axis);
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const planeSources = model.members.filter((member) => {
    const a = nodeById.get(member.i);
    const b = nodeById.get(member.j);
    return a && b && onPlane(a, axis, coordinate) && onPlane(b, axis, coordinate);
  });
  const planeNodeIds = new Set(planeSources.flatMap((member) => [member.i, member.j]));
  const planeNodes = model.nodes.filter((node) => planeNodeIds.has(node.id));
  const nodeIndex = new Map(planeNodes.map((node, index) => [node.id, index]));
  const nodes: StructureNode[] = planeNodes.map((node) => ({ x: inPlaneOf(node, axis), y: node.y, support: supportOf(node, axis) }));
  let fcMpa: number | null = null;

  // Cargas de referencia por barra para dibujar la viga (uniformes de longitud completa y la mayor puntual).
  const caseById = new Map(model.loadCases.map((item) => [item.id, item]));
  const displayLoads = (member: Space3DFrameMember, length: number) => {
    let dead = 0;
    let live = 0;
    let point: { deadKn: number; liveKn: number; atM: number } | undefined;
    for (const load of model.memberLoads) {
      const loadCase = caseById.get(load.caseId);
      if (load.memberId !== member.id || loadCase?.active === false || (loadCase?.category !== 'permanent' && loadCase?.category !== 'variable')) continue;
      const isDead = loadCase.category === 'permanent';
      if (load.type === 'distributed' && load.coordinateSystem === 'global' && load.start <= 1e-9 && load.end >= 1 - 1e-9 && (load.qyStart ?? 0) === (load.qyEnd ?? 0)) {
        if (isDead) dead -= load.qyStart ?? 0; else live -= load.qyStart ?? 0;
      } else if (load.type === 'point' && load.coordinateSystem === 'global' && (load.py ?? 0) < 0) {
        const magnitude = -(load.py ?? 0);
        if (!point || magnitude > point.deadKn + point.liveKn) point = { deadKn: isDead ? magnitude : 0, liveKn: isDead ? 0 : magnitude, atM: (load.position ?? load.start) * length };
      }
    }
    return { dead: Math.max(0, dead), live: Math.max(0, live), point };
  };

  const planeMembers: PlaneMember[] = [];
  const members: StructureMember[] = [];
  let rolled = false;
  for (const member of planeSources) {
    const a = nodeById.get(member.i)!;
    const b = nodeById.get(member.j)!;
    let bending: PlaneMember['bending'] = 'y';
    let sign: PlaneMember['sign'] = 1;
    try {
      const basis = buildMemberOrientation([a.x, a.y, a.z], [b.x, b.y, b.z], member.orientation);
      const transverse = cross(normal, basis.x);
      const alongY = dot(basis.y, transverse);
      const alongZ = dot(basis.z, transverse);
      bending = Math.abs(alongY) >= Math.abs(alongZ) ? 'y' : 'z';
      const component = bending === 'y' ? alongY : alongZ;
      sign = component >= 0 ? 1 : -1;
      if (Math.abs(component) < 0.999) rolled = true;
    } catch {
      errors.push(`${member.label?.trim() || member.id}: su orientación no es válida; corrígela en el modo 3D.`);
    }
    planeMembers.push({ source: member, bending, sign });
    const inertia = bending === 'y' ? member.Iz : member.Iy;
    const height = Math.sqrt(12 * inertia / Math.max(member.A, 1e-12));
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const slope = length > 0 ? Math.abs(b.y - a.y) / length : 0;
    const loads = displayLoads(member, length);
    const base = {
      id: member.id,
      label: member.label?.trim() || member.id,
      i: nodeIndex.get(member.i)!,
      j: nodeIndex.get(member.j)!,
      section: { widthMm: member.A / height * 1e3, heightMm: height * 1e3 },
      flexuralStiffnessKnM2: member.E * inertia,
      displayDeadKnPerM: loads.dead,
      displayLiveKnPerM: loads.live,
      ...(loads.point ? { displayPoint: loads.point } : {}),
    };
    const material = concreteOf(member);
    if ((member.type ?? 'frame') !== 'frame') members.push({ ...base, kind: 'other', reason: member.type === 'truss' ? 'barra de armadura (sólo axial)' : 'brazo rígido' });
    else if (!material.concrete) members.push({ ...base, kind: 'other', reason: 'name' in material && material.name ? `material ${material.name}` : 'su módulo de elasticidad no es de concreto' });
    else {
      if (material.fcMpa !== null) fcMpa = fcMpa === null ? material.fcMpa : Math.min(fcMpa, material.fcMpa);
      members.push({ ...base, kind: slope <= 0.5 ? 'beam' : 'column' });
    }
  }
  if (rolled) notes.push('Hay barras con la sección girada respecto al plano del eje: se diseñan con la flexión del eje local más cercano.');
  notes.push('Acciones del Modelo 3D completo. Vigas: flexión en el plano del eje. Columnas: flexión biaxial; la perpendicular se amplifica con su propia k (vigas de esa dirección) y el índice de estabilidad del pórtico perpendicular.');

  // Casos: muertos enteros, vivos partidos por barra del eje y laterales; el sondeo se agrega al crear la fuente.
  const active = (item: Space3DLoadCase) => item.active !== false;
  const ignoredCases = model.loadCases.filter((item) => !active(item) || !item.category || item.category === 'other')
    .map((item) => `${item.name}${active(item) ? '' : ' (inactivo)'}`);
  const planeMemberIds = new Set(planeSources.map((member) => member.id));
  const projected: ProjectedCase[] = [];
  const projection = { loadCases: [] as Space3DLoadCase[], memberLoads: [] as Space3DProjectV1['memberLoads'][number][], nodalLoads: [] as Space3DProjectV1['nodalLoads'][number][] };
  const carry = (caseId: string, solverId: string, memberLoads: (memberId: string) => boolean, nodal: boolean) => {
    projection.memberLoads.push(...model.memberLoads.filter((load) => load.caseId === caseId && memberLoads(load.memberId)).map((load) => ({ ...load, caseId: solverId })));
    if (nodal) projection.nodalLoads.push(...model.nodalLoads.filter((load) => load.caseId === caseId).map((load) => ({ ...load, caseId: solverId })));
  };
  for (const loadCase of model.loadCases.filter(active)) {
    if (loadCase.category === 'permanent' || loadCase.category === 'accidental') {
      projection.loadCases.push({ ...loadCase, active: true });
      carry(loadCase.id, loadCase.id, () => true, true);
      projected.push({ case: { id: loadCase.id, label: loadCase.name, kind: loadCase.category === 'permanent' ? 'dead' : 'lateral' }, solverId: loadCase.id });
    } else if (loadCase.category === 'variable') {
      const loaded = [...new Set(model.memberLoads.filter((load) => load.caseId === loadCase.id && planeMemberIds.has(load.memberId)).map((load) => load.memberId))];
      for (const memberId of loaded) {
        const solverId = `${loadCase.id}§${memberId}`;
        projection.loadCases.push({ id: solverId, name: `${loadCase.name} · ${memberId}`, category: 'variable', active: true, selfWeightFactor: 0 });
        carry(loadCase.id, solverId, (id) => id === memberId, false);
        const label = planeSources.find((member) => member.id === memberId)?.label?.trim() || memberId;
        projected.push({ case: { id: solverId, label: `${loadCase.name} · ${label}`, kind: 'live' }, solverId });
      }
      const rest = model.memberLoads.some((load) => load.caseId === loadCase.id && !planeMemberIds.has(load.memberId))
        || model.nodalLoads.some((load) => load.caseId === loadCase.id)
        || (loadCase.selfWeightFactor ?? 0) !== 0;
      if (rest) {
        const solverId = `${loadCase.id}§resto`;
        projection.loadCases.push({ id: solverId, name: `${loadCase.name} · resto`, category: 'variable', active: true, selfWeightFactor: loadCase.selfWeightFactor ?? 0 });
        carry(loadCase.id, solverId, (id) => !planeMemberIds.has(id), true);
        projected.push({ case: { id: solverId, label: `${loadCase.name} · resto del modelo`, kind: 'live' }, solverId });
      }
    }
  }
  const beams = members.filter((member) => member.kind === 'beam').length;
  const columns = members.filter((member) => member.kind === 'column').length;
  const deadCases = projected.filter((item) => item.case.kind === 'dead').length;
  const liveCases = projected.filter((item) => item.case.kind === 'live').length;
  const lateralCases = projected.filter((item) => item.case.kind === 'lateral').length;
  if (!beams && !columns) errors.push(`«${plane.label}» no tiene barras de concreto que diseñar (vigas o columnas con material de concreto).`);
  if (!deadCases && !liveCases) errors.push('El Modelo 3D no tiene casos permanentes ni variables activos (la categoría de cada caso se define en el modo 3D).');
  if (model.prescribedDisplacements.length || model.memberInitialEffects.length) notes.push('Los desplazamientos impuestos y los efectos de temperatura del modelo no entran en el diseño.');
  if (model.generatedLoadSources.length || model.movingLoadCases.length) notes.push('Las cargas generadas y móviles del modelo no entran en el diseño.');
  if (model.loadCombinations.length) notes.push('Las combinaciones del modelo no se usan: el taller aplica las de la norma con la categoría de cada caso.');
  if ((model.diaphragms ?? []).length) notes.push('El sondeo lateral analiza el eje solo, sin diafragma: la rigidez del entrepiso es la de su pórtico.');

  // Flechas de la lámina: la primera acción lateral sobre los nudos del eje, sumada por elevación.
  const firstLateral = projected.find((item) => item.case.kind === 'lateral');
  const lateralByLevel = new Map<number, number>();
  for (const load of firstLateral ? model.nodalLoads.filter((item) => item.caseId === firstLateral.solverId && nodeIndex.has(item.nodeId)) : []) {
    const force = axis === 'z' ? load.fx : load.fz;
    if (force === 0) continue;
    const y = Math.round(nodeById.get(load.nodeId)!.y * 200) / 200;
    lateralByLevel.set(y, (lateralByLevel.get(y) ?? 0) + force);
  }
  const lateralLevels = [...lateralByLevel.entries()].sort((a, b) => a[0] - b[0]).map(([y, kN]) => ({ y, kN: Math.abs(kN) }));
  const includesSelfWeight = model.loadCases.some((item) => active(item) && item.category === 'permanent' && (item.selfWeightFactor ?? 0) > 0);

  const displacementOf = (result: Space3DNodeResult | undefined): readonly [number, number, number] => {
    if (!result) return [0, 0, 0];
    const { displacement: d } = result;
    return axis === 'z' ? [d.ux, d.uy, d.rz] : [d.uz, d.uy, -d.rx];
  };
  /** [s, y, giro en el plano] de un nudo a partir del vector de desplazamientos (6 GDL por nudo). */
  const inPlaneOfVector = (vector: readonly number[], node: number): readonly [number, number, number] => {
    const base = node * 6;
    return axis === 'z' ? [vector[base] ?? 0, vector[base + 1] ?? 0, vector[base + 5] ?? 0] : [vector[base + 2] ?? 0, vector[base + 1] ?? 0, -(vector[base + 3] ?? 0)];
  };
  const withOverrides = (list: readonly Space3DFrameMember[], overrides: ReadonlyMap<number, number> | undefined) => {
    if (!overrides?.size) return list;
    const byId = new Map(planeMembers.flatMap((member, index) => overrides.has(index) ? [[member.source.id, { member, inertia: overrides.get(index)! }] as const] : []));
    return list.map((member) => {
      const override = byId.get(member.id);
      if (!override) return member;
      return override.member.bending === 'y' ? { ...member, Iz: override.inertia } : { ...member, Iy: override.inertia };
    });
  };

  return {
    label: `${model.name} · ${plane.label}`,
    revision: revisionOf(model, planeId),
    summary: { members: members.length, beams, columns, skipped: members.length - beams - columns, deadCases, liveCases, lateralCases, ignoredCases },
    fcMpa,
    includesSelfWeight,
    errors,
    create({ braced }): StructureSource | null {
      if (errors.length) return null;
      const cases: ProjectedCase[] = braced ? projected.filter((item) => item.case.kind !== 'lateral') : [...projected];
      const probe = braced ? [] : probeLoads(nodes, members);
      if (probe.length) cases.push({ case: { id: PROBE_CASE, label: 'Sondeo lateral (eje solo)', kind: 'probe' }, solverId: PROBE_CASE });
      // Lo dinámico (masas, espectros) no entra al análisis estático y apunta a
      // casos que la proyección renombra: se deja fuera.
      const { massSource: _mass, spectrumFunctions: _spectra, responseSpectrumCases: _cases, nodalMasses: _masses, ...statics } = model;
      const full: Space3DProjectV1 = {
        ...statics,
        nodalMasses: [],
        loadCases: projection.loadCases,
        loadCombinations: [],
        memberLoads: projection.memberLoads,
        nodalLoads: projection.nodalLoads,
        prescribedDisplacements: [],
        memberInitialEffects: [],
        generatedLoadSources: [],
        movingLoadCases: [],
      };
      // El eje aislado para el sondeo: fuera del plano, nudos restringidos.
      const isolated: Space3DProjectV1 = {
        ...full,
        nodes: planeNodes.map((node) => ({
          ...node,
          restraints: axis === 'z'
            ? { ...node.restraints, uz: true, rx: true, ry: true }
            : { ...node.restraints, ux: true, ry: true, rz: true },
        })),
        members: planeSources,
        loadCases: [{ id: PROBE_CASE, name: 'Sondeo lateral', category: 'other', active: true, selfWeightFactor: 0 }],
        memberLoads: [],
        nodalLoads: probe.map((item, index) => ({
          id: `${PROBE_CASE}-${index}`, caseId: PROBE_CASE, nodeId: planeNodes[item.node]!.id,
          fx: axis === 'z' ? item.fx : 0, fy: 0, fz: axis === 'z' ? 0 : item.fx, mx: 0, my: 0, mz: 0,
        })),
        diaphragms: [],
        nodeLinks: [],
        multiPointConstraints: [],
      };
      // ── Dirección perpendicular de las columnas del eje ──
      // ψ con las vigas de esa dirección, y el entrepiso del pórtico
      // perpendicular (el plano x = cte o z = cte que pasa por la columna):
      // su rigidez lateral con un sondeo de ese pórtico solo y sus columnas,
      // para sumar su carga vertical en cada caso.
      const perpendicularAxis: PlaneAxis = axis === 'z' ? 'x' : 'z';
      const across: Space3DVector = axis === 'z' ? [0, 0, 1] : [1, 0, 0];
      const up: Space3DVector = [0, 1, 0];
      const adjacency = new Map<string, Space3DFrameMember[]>();
      for (const member of model.members) {
        for (const id of [member.i, member.j]) adjacency.set(id, [...(adjacency.get(id) ?? []), member]);
      }
      /** EI/L de la flexión cuya dirección transversal es `transverse`. */
      const bendingStiffness = (member: Space3DFrameMember, transverse: Space3DVector) => {
        const a = nodeById.get(member.i)!;
        const b = nodeById.get(member.j)!;
        const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        try {
          const basis = buildMemberOrientation([a.x, a.y, a.z], [b.x, b.y, b.z], member.orientation);
          const inertia = Math.abs(dot(basis.y, transverse)) >= Math.abs(dot(basis.z, transverse)) ? member.Iz : member.Iy;
          return length > 0 ? member.E * inertia / length : 0;
        } catch {
          return 0;
        }
      };
      const directionOf = (member: Space3DFrameMember): Space3DVector => {
        const a = nodeById.get(member.i)!;
        const b = nodeById.get(member.j)!;
        const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
        return [(b.x - a.x) / length, (b.y - a.y) / length, (b.z - a.z) / length];
      };
      const psiAcross = (nodeId: string) => {
        const node = nodeById.get(nodeId)!;
        const { restraints } = node;
        if (restraints.ux || restraints.uy || restraints.uz) return (axis === 'z' ? restraints.rx : restraints.rz) ? 1 : 10;
        let columns = 0;
        let beams = 0;
        for (const member of adjacency.get(nodeId) ?? []) {
          if ((member.type ?? 'frame') !== 'frame') continue;
          const direction = directionOf(member);
          if (Math.abs(direction[1]) > 0.5) columns += bendingStiffness(member, across);
          else if (Math.abs(dot(direction, across)) > 0.99) beams += bendingStiffness(member, up);
        }
        return beams > 0 ? columns / beams : 10;
      };
      const roundLevel = (value: number) => Math.round(value / 0.005) * 0.005;
      type PerpendicularStory = { readonly stiffnessKnPerM: number; readonly heightM: number; readonly columns: readonly { readonly id: string; readonly bottomIsI: boolean }[] };
      const perpendicularFrames = new Map<string, Map<string, PerpendicularStory>>();
      const perpendicularStoriesAt = (coordinate: number): Map<string, PerpendicularStory> => {
        const key = keyOf(coordinate).toFixed(6);
        const cached = perpendicularFrames.get(key);
        if (cached) return cached;
        const stories = new Map<string, PerpendicularStory>();
        perpendicularFrames.set(key, stories);
        const frameMembers = model.members.filter((member) => {
          const a = nodeById.get(member.i);
          const b = nodeById.get(member.j);
          return a && b && onPlane(a, perpendicularAxis, coordinate) && onPlane(b, perpendicularAxis, coordinate);
        });
        const columnsOf = frameMembers.filter((member) => (member.type ?? 'frame') === 'frame' && Math.abs(directionOf(member)[1]) > 0.5);
        if (!columnsOf.length || frameMembers.length === columnsOf.length) return stories;
        const frameNodeIds = new Set(frameMembers.flatMap((member) => [member.i, member.j]));
        const frameNodes = model.nodes.filter((node) => frameNodeIds.has(node.id));
        const levels = [...new Set(columnsOf.map((member) => roundLevel(Math.max(nodeById.get(member.i)!.y, nodeById.get(member.j)!.y))))].sort((a, b) => a - b);
        const probeLoadsAcross = levels.flatMap((level) => {
          const at = frameNodes.filter((node) => Math.abs(roundLevel(node.y) - level) < 0.0025);
          return at.map((node) => ({ node, force: 1 / at.length }));
        });
        const frame: Space3DProjectV1 = {
          ...full,
          nodes: frameNodes.map((node) => ({
            ...node,
            restraints: perpendicularAxis === 'z' ? { ...node.restraints, uz: true, rx: true, ry: true } : { ...node.restraints, ux: true, ry: true, rz: true },
          })),
          members: frameMembers,
          loadCases: [{ id: PROBE_CASE, name: 'Sondeo lateral', category: 'other', active: true, selfWeightFactor: 0 }],
          memberLoads: [],
          nodalLoads: probeLoadsAcross.map((item, index) => ({
            id: `${PROBE_CASE}-x${index}`, caseId: PROBE_CASE, nodeId: item.node.id,
            fx: perpendicularAxis === 'z' ? item.force : 0, fy: 0, fz: perpendicularAxis === 'z' ? 0 : item.force, mx: 0, my: 0, mz: 0,
          })),
          diaphragms: [],
          nodeLinks: [],
          multiPointConstraints: [],
        };
        const run = analyzeSpace3DProject(frame, PROBE_CASE, { stationSegments: 2 });
        if (!run.success) return stories;
        const along = (nodeId: string) => {
          const d = run.nodeResults.find((result) => result.nodeId === nodeId)?.displacement;
          return d ? (perpendicularAxis === 'z' ? d.ux : d.uz) : 0;
        };
        const groups = new Map<string, { bottom: number; top: number; columns: { id: string; bottomIsI: boolean; drift: number }[] }>();
        for (const member of columnsOf) {
          const a = nodeById.get(member.i)!;
          const b = nodeById.get(member.j)!;
          const bottomIsI = a.y <= b.y;
          const [bottom, top] = bottomIsI ? [a, b] : [b, a];
          const storyKey = `${roundLevel(bottom.y)}|${roundLevel(top.y)}`;
          const group = groups.get(storyKey) ?? { bottom: bottom.y, top: top.y, columns: [] };
          group.columns.push({ id: member.id, bottomIsI, drift: along(top.id) - along(bottom.id) });
          groups.set(storyKey, group);
        }
        for (const [storyKey, group] of groups) {
          const drift = group.columns.reduce((sum, column) => sum + column.drift, 0) / group.columns.length;
          const shear = levels.filter((level) => level >= roundLevel(group.top) - 0.0025).length;
          if (!(Math.abs(drift) > 1e-12)) continue;
          stories.set(storyKey, { stiffnessKnPerM: shear / Math.abs(drift), heightM: group.top - group.bottom, columns: group.columns.map(({ id, bottomIsI }) => ({ id, bottomIsI })) });
        }
        return stories;
      };
      /** Para cada columna del eje: su entrepiso en el pórtico perpendicular, si existe. */
      const perpendicularStoryOf = new Map<number, PerpendicularStory>();
      const membersAcross: StructureMember[] = members.map((member, index) => {
        if (member.kind !== 'column') return member;
        const source = planeMembers[index]!.source;
        const a = nodeById.get(source.i)!;
        const b = nodeById.get(source.j)!;
        const [bottom, top] = a.y <= b.y ? [a, b] : [b, a];
        const stories = perpendicularStoriesAt(axis === 'z' ? a.x : a.z);
        const story = stories.get(`${roundLevel(bottom.y)}|${roundLevel(top.y)}`);
        if (story) perpendicularStoryOf.set(index, story);
        return {
          ...member,
          outOfPlane: {
            psiTop: psiAcross(top.id),
            psiBottom: psiAcross(bottom.id),
            ...(story ? { story: { stiffnessKnPerM: story.stiffnessKnPerM, heightM: story.heightM } } : {}),
          },
        };
      });
      const cache = new Map<string, ReturnType<StructureSource['analyze']>>();
      const fullNodeIndex = new Map(full.nodes.map((node, index) => [node.id, index]));
      const planeNodeIndexes = planeNodes.map((node) => fullNodeIndex.get(node.id)!);
      const solverCases = cases.filter((item) => item.solverId !== PROBE_CASE);
      const failure = (detail: string, label?: string) => ({ ok: false as const, error: `El Modelo 3D no se pudo resolver${label ? ` en «${label}»` : ''}: ${detail}.` });

      // Cargas de cada caso, una vez: el vector nodal y las cargas de las barras
      // del eje. No dependen de las inercias (las del agrietamiento tampoco las
      // cambian), así que sirven para todos los análisis de esta fuente. Cada
      // caso se arma sólo con sus barras cargadas: la viva de una barra es una.
      type CaseLoads = { readonly vector: readonly number[]; readonly elements: ReadonlyMap<string, Space3DStaticAssemblyElement> };
      let loads: Map<string, CaseLoads> | { readonly error: string } | null = null;
      const caseLoads = () => {
        if (loads) return loads;
        const table = new Map<string, CaseLoads>();
        for (const item of solverCases) {
          const definition = full.loadCases.find((loadCase) => loadCase.id === item.solverId)!;
          const memberLoads = full.memberLoads.filter((load) => load.caseId === item.solverId);
          const nodalLoads = full.nodalLoads.filter((load) => load.caseId === item.solverId);
          const loaded = new Set(memberLoads.map((load) => load.memberId));
          // Peso propio o cargas en nudos: todas las barras (un nudo cargado sin
          // barras sería un mecanismo para el ensamblador).
          const everyMember = (definition.selfWeightFactor ?? 0) !== 0 || nodalLoads.length > 0;
          const project = (members: readonly Space3DFrameMember[]): Space3DProjectV1 => ({ ...full, members, loadCases: [definition], memberLoads, nodalLoads });
          const pruned = everyMember ? null : assembleSpace3DStaticModel(project(full.members.filter((member, index) => index === 0 || loaded.has(member.id))), item.solverId, { stationSegments: STATION_SEGMENTS });
          const assembly = pruned?.valid ? pruned : assembleSpace3DStaticModel(project(full.members), item.solverId, { stationSegments: STATION_SEGMENTS });
          if (!assembly.valid) return (loads = { error: failure(issueText(assembly.issues[0]), item.case.label).error });
          table.set(item.solverId, { vector: assembly.loadVector, elements: new Map(assembly.elements.map((element) => [element.memberId, element])) });
        }
        return (loads = table);
      };

      /**
       * Todos los casos con una sola rigidez: se arma y factoriza una vez y cada
       * caso es una sustitución. Las barras del eje se reconstruyen sólo cuando
       * el diseño las lee (la flecha de una viga lee las suyas).
       */
      const solve = (overrides: ReadonlyMap<number, number> | undefined): StructureAnalysisOutcome => {
        const table = caseLoads();
        if (!(table instanceof Map)) return { ok: false, error: table.error };
        const project = overrides?.size ? { ...full, members: withOverrides(full.members, overrides) } : full;
        let assembly: Space3DStaticAssembly | null = null;
        let factorization: Space3DSkylineFactorization | null = null;
        if (solverCases.length) {
          assembly = assembleSpace3DStaticModel(project, solverCases[0]!.solverId, { stationSegments: STATION_SEGMENTS });
          if (!assembly.valid) return failure(issueText(assembly.issues[0]));
          if (assembly.equations.count > 0) {
            try {
              factorization = factorizeSkyline(assembleSpace3DSkylineStiffness(assembly));
            } catch (error) {
              if (!(error instanceof Space3DSingularMatrixError)) throw error;
              return failure(issueText(space3DMechanismIssue(project, assembly, error.row)));
            }
          }
        }
        const elementOf = new Map((assembly?.elements ?? []).map((element) => [element.memberId, element]));
        const results: StructureCaseResult[] = [];
        for (const item of cases) {
          if (item.solverId === PROBE_CASE) {
            const isolatedModel = overrides?.size ? { ...isolated, members: withOverrides(isolated.members, overrides) } : isolated;
            const run = analyzeSpace3DProject(isolatedModel, PROBE_CASE, { stationSegments: STATION_SEGMENTS });
            if (!run.success) return failure(issueText(run.issues[0]), item.case.label);
            const byNode = new Map(run.nodeResults.map((result) => [result.nodeId, result]));
            const byMember = new Map(run.memberResults.map((result) => [result.memberId, result]));
            const samples = planeMembers.map((member) => {
              const result = byMember.get(member.source.id);
              return samplesOf(result?.length ?? 0, (result?.stations ?? []).map((station) => inPlaneStation(station, member)));
            });
            results.push({
              nodeDisplacements: planeNodes.map((node) => displacementOf(byNode.get(node.id))),
              at: (memberIndex, x) => {
                const member = samples[memberIndex];
                return member ? sampleStations(member, x) : ZERO_ACTION;
              },
            });
            continue;
          }
          const load = table.get(item.solverId)!;
          const displacement = assembly && factorization
            ? expandSpace3DVector(assembly.equations, factorization.solve(reduceSpace3DVector(assembly.equations, load.vector)))
            : new Array<number>(full.nodes.length * 6).fill(0);
          if (displacement.some((value) => !Number.isFinite(value))) return failure('la solución no es finita', item.case.label);
          const samples: (MemberSamples | undefined)[] = [];
          // Una barra del eje en este caso: rigidez de la solución (con las
          // inercias del análisis) y cargas del caso, como recupera el motor 3D.
          const recover = (memberIndex: number): MemberSamples => {
            const member = planeMembers[memberIndex]!;
            const element = elementOf.get(member.source.id);
            if (!element) return samplesOf(0, []);
            const loaded = load.elements.get(member.source.id);
            const uLocal = multiplyMatrixVector(element.transformation, element.dofIndices.map((index) => displacement[index] ?? 0));
            const fixedEnd = loaded?.fixedEndForces ?? ZERO_END_FORCES;
            const endForces = multiplyMatrixVector(element.localStiffness, uLocal).map((value, index) => value + (fixedEnd[index] ?? 0));
            const stations = computeSpace3DMemberStations({
              length: element.length,
              kind: element.kind,
              E: element.E,
              Iy: element.Iy,
              Iz: element.Iz,
              endForces,
              endDisplacements: recoverMemberEndDisplacements(element.element, uLocal, loaded?.rawFixedEndForces ?? ZERO_END_FORCES),
              loads: loaded?.loads ?? EMPTY_LOCAL_LOADS,
              segments: STATION_SEGMENTS,
            });
            return samplesOf(element.length, stations.map((station) => inPlaneStation(station, member)));
          };
          // Compresión en la base de una columna con la solución y las cargas del caso.
          const compressionOf = (memberId: string, bottomIsI: boolean) => {
            const element = elementOf.get(memberId);
            if (!element) return 0;
            const uLocal = multiplyMatrixVector(element.transformation, element.dofIndices.map((index) => displacement[index] ?? 0));
            const fixedEnd = load.elements.get(memberId)?.fixedEndForces ?? ZERO_END_FORCES;
            const forces = multiplyMatrixVector(element.localStiffness, uLocal).map((value, index) => value + (fixedEnd[index] ?? 0));
            return bottomIsI ? forces[0]! : -forces[6]!;
          };
          const storyAxial = new Map<PerpendicularStory, number>();
          results.push({
            nodeDisplacements: planeNodeIndexes.map((node) => inPlaneOfVector(displacement, node)),
            at: (memberIndex, x) => {
              if (memberIndex < 0 || memberIndex >= planeMembers.length) return ZERO_ACTION;
              const member = samples[memberIndex] ??= recover(memberIndex);
              return sampleStations(member, x);
            },
            outOfPlaneStoryAxial: (memberIndex) => {
              const story = perpendicularStoryOf.get(memberIndex);
              if (!story) return 0;
              let total = storyAxial.get(story);
              if (total === undefined) {
                total = story.columns.reduce((sum, column) => sum + compressionOf(column.id, column.bottomIsI), 0);
                storyAxial.set(story, total);
              }
              return total;
            },
          });
        }
        return { ok: true, cases: results };
      };

      return {
        kind: 'model3d',
        label: `Modelo 3D · ${model.name} · ${plane.label}`,
        nodes,
        members: membersAcross,
        cases: cases.map((item) => item.case),
        braced,
        notes,
        lateralLevels: braced ? [] : lateralLevels,
        gridLabelAt: (coordinate) => gridLines.find((line) => Math.abs(line.coordinate - coordinate) <= 5 * PLANE_TOLERANCE)?.id ?? null,
        analyze(overrides) {
          const key = overrides?.size ? [...overrides.entries()].map(([index, value]) => `${index}:${value.toPrecision(6)}`).join('|') : '';
          const cached = cache.get(key);
          if (cached) return cached;
          const outcome = solve(overrides);
          if (cache.size > 24) cache.delete(cache.keys().next().value!);
          cache.set(key, outcome);
          return outcome;
        },
      };
    },
  };
}

/** Los ejes diseñables del Modelo 3D para la mesa Estructura; cada fuente se arma una vez. */
export function space3dDesignAxes(model: Space3DProjectV1): ExternalStructureAxes {
  const planes = space3dFramePlanes(model);
  const sources = new Map<string, ExternalStructureSource>();
  // Columnas en planta: barras verticales agrupadas por su punto (x, z).
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const stacks = new Map<string, { x: number; z: number; memberIds: string[] }>();
  for (const member of model.members) {
    const a = nodeById.get(member.i);
    const b = nodeById.get(member.j);
    if (!a || !b || Math.abs(a.x - b.x) > PLANE_TOLERANCE || Math.abs(a.z - b.z) > PLANE_TOLERANCE || Math.abs(a.y - b.y) <= PLANE_TOLERANCE) continue;
    const key = `${keyOf(a.x)}|${keyOf(a.z)}`;
    const stack = stacks.get(key) ?? { x: keyOf(a.x), z: keyOf(a.z), memberIds: [] };
    stack.memberIds.push(member.id);
    stacks.set(key, stack);
  }
  return {
    label: model.name,
    axes: planes.map((plane) => ({ id: plane.id, label: plane.label, short: plane.short, direction: plane.axis, coordinate: plane.coordinate, members: plane.members })),
    columns: [...stacks.values()],
    axesOfMember(memberId) {
      const member = model.members.find((item) => item.id === memberId);
      const a = member ? nodeById.get(member.i) : undefined;
      const b = member ? nodeById.get(member.j) : undefined;
      if (!a || !b) return [];
      return planes.filter((plane) => onPlane(a, plane.axis, plane.coordinate) && onPlane(b, plane.axis, plane.coordinate)).map((plane) => plane.id);
    },
    source(axisId) {
      let source = sources.get(axisId);
      if (!source) {
        source = space3dDesignSource(model, axisId);
        sources.set(axisId, source);
      }
      return source;
    },
  };
}
