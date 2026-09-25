/**
 * «Asignar» al modo de ETABS: se selecciona primero y se asigna después.
 *
 * Cada función traduce una asignación sobre la selección a UN comando (un
 * lote), de modo que deshacer revierte la asignación entera y el validador del
 * store la acepta o la rechaza completa. Nada aquí toca React.
 */
import type { Space3DCommand } from '../../space3d/data/commands';
import type {
  Space3DFrameMember, Space3DMemberLoad, Space3DMemberRelease, Space3DNodalLoad, Space3DProjectV1, Space3DRestraints,
} from '../../space3d/model/types';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG } from '../../space3d/model/sectionLibrary';
import type { Space3DSelection } from '../../space3d/store/Space3DProjectContext';

/** Selección múltiple: identificadores en el orden en que se eligieron. */
export interface Space3DSelectionSet {
  readonly nodes: readonly string[];
  readonly members: readonly string[];
}

export const EMPTY_SPACE3D_SELECTION: Space3DSelectionSet = Object.freeze({ nodes: Object.freeze([]), members: Object.freeze([]) });

export const space3DSelectionSize = (selection: Space3DSelectionSet): number => selection.nodes.length + selection.members.length;

/** Un clic: reemplaza, o con modificador suma/quita. `null` sin modificador limpia. */
export const applySpace3DPick = (
  current: Space3DSelectionSet,
  pick: Space3DSelection | null,
  additive: boolean,
): Space3DSelectionSet => {
  if (!pick || pick.kind === 'load') return additive ? current : EMPTY_SPACE3D_SELECTION;
  const key = pick.kind === 'node' ? 'nodes' : 'members';
  if (!additive) return { nodes: key === 'nodes' ? [pick.id] : [], members: key === 'members' ? [pick.id] : [] };
  const list = current[key];
  const next = list.includes(pick.id) ? list.filter((id) => id !== pick.id) : [...list, pick.id];
  return { ...current, [key]: next };
};

/** Una ventana: reemplaza, o con modificador añade lo nuevo. */
export const applySpace3DWindow = (
  current: Space3DSelectionSet,
  pick: Space3DSelectionSet,
  additive: boolean,
): Space3DSelectionSet => {
  if (!additive) return { nodes: [...pick.nodes], members: [...pick.members] };
  return {
    nodes: [...current.nodes, ...pick.nodes.filter((id) => !current.nodes.includes(id))],
    members: [...current.members, ...pick.members.filter((id) => !current.members.includes(id))],
  };
};

/** Quita de la selección lo que ya no existe (tras deshacer, borrar, importar). */
export const pruneSpace3DSelection = (project: Space3DProjectV1, selection: Space3DSelectionSet): Space3DSelectionSet => {
  const nodes = new Set(project.nodes.map((node) => node.id));
  const members = new Set(project.members.map((member) => member.id));
  const keptNodes = selection.nodes.filter((id) => nodes.has(id));
  const keptMembers = selection.members.filter((id) => members.has(id));
  return keptNodes.length === selection.nodes.length && keptMembers.length === selection.members.length
    ? selection
    : { nodes: keptNodes, members: keptMembers };
};

/** El elemento «primario» de la selección, el que edita el inspector: el último elegido. */
export const primarySpace3DSelection = (selection: Space3DSelectionSet, order: 'node' | 'member' | null): Space3DSelection | null => {
  if (order === 'node' && selection.nodes.length > 0) return { kind: 'node', id: selection.nodes[selection.nodes.length - 1] };
  if (selection.members.length > 0) return { kind: 'member', id: selection.members[selection.members.length - 1] };
  if (selection.nodes.length > 0) return { kind: 'node', id: selection.nodes[selection.nodes.length - 1] };
  return null;
};

const batch = (commands: readonly Space3DCommand[]): Space3DCommand | null =>
  commands.length === 0 ? null : commands.length === 1 ? commands[0] : { kind: 'batch', commands };

const nextIds = (prefix: string, used: Iterable<string>, count: number): string[] => {
  const taken = new Set(used);
  const ids: string[] = [];
  let index = 1;
  while (ids.length < count) {
    const candidate = `${prefix}${index}`;
    if (!taken.has(candidate)) { ids.push(candidate); taken.add(candidate); }
    index += 1;
  }
  return ids;
};

/** Sección de catálogo, con su material, a todas las barras elegidas. */
export const space3DAssignSectionCommand = (memberIds: readonly string[], sectionName: string): Space3DCommand | null => {
  const section = SPACE3D_SECTION_CATALOG.find((item) => item.name === sectionName);
  if (!section) return null;
  const material = SPACE3D_MATERIALS.find((item) => item.id === section.materialId);
  if (!material) return null;
  const changes: Partial<Omit<Space3DFrameMember, 'id'>> = {
    E: material.E, G: material.G, A: section.A, Iy: section.Iy, Iz: section.Iz, J: section.J,
    materialId: material.id, materialOrigin: 'catalog', sectionId: section.name, sectionOrigin: 'catalog',
    density: material.massDensityKgPerM3,
  };
  return batch(memberIds.map((memberId) => ({ kind: 'update-member', memberId, changes })));
};

export type Space3DReleasePreset = 'continuous' | 'pinned-i' | 'pinned-j' | 'pinned-both';

export const SPACE3D_RELEASE_PRESETS: Readonly<Record<Space3DReleasePreset, Space3DMemberRelease | undefined>> = Object.freeze({
  continuous: undefined,
  'pinned-i': Object.freeze({ iRy: true, iRz: true }),
  'pinned-j': Object.freeze({ jRy: true, jRz: true }),
  'pinned-both': Object.freeze({ iRy: true, iRz: true, jRy: true, jRz: true }),
});

/** Liberaciones a las barras elegidas; `undefined` las quita (continuidad). */
export const space3DAssignReleasesCommand = (
  project: Space3DProjectV1,
  memberIds: readonly string[],
  releases: Space3DMemberRelease | undefined,
): Space3DCommand | null => {
  const clean = releases && Object.values(releases).some(Boolean) ? releases : undefined;
  // Sin liberaciones el campo queda vacío; al guardarse en JSON desaparece.
  return batch(memberIds.flatMap((memberId): Space3DCommand[] => {
    const member = project.members.find((item) => item.id === memberId);
    if (!member || (!clean && !member.releases)) return [];
    return [{ kind: 'update-member', memberId, changes: { releases: clean } }];
  }));
};

/** Pórtico o armadura. En una armadura las liberaciones se conservan pero no cuentan. */
export const space3DAssignMemberTypeCommand = (
  project: Space3DProjectV1,
  memberIds: readonly string[],
  type: 'frame' | 'truss',
): Space3DCommand | null => batch(memberIds.flatMap((memberId): Space3DCommand[] => {
  const member = project.members.find((item) => item.id === memberId);
  if (!member || (member.type ?? 'frame') === type) return [];
  return [{ kind: 'update-member', memberId, changes: { type } }];
}));

export type Space3DMemberLoadDirection = 'gravity' | 'x' | 'y' | 'z' | 'local-1' | 'local-2' | 'local-3';

interface DistributedAssignment {
  readonly caseId: string;
  readonly direction: Space3DMemberLoadDirection;
  /** kN/m; en «gravedad», positivo hacia abajo. */
  readonly value: number;
  /** Tramo relativo cargado, [0, 1]. */
  readonly start?: number;
  readonly end?: number;
  /** `replace` borra antes las cargas en barra de ese caso sobre esas barras. */
  readonly mode: 'add' | 'replace';
}

const directionComponents = (direction: Space3DMemberLoadDirection, value: number): { system: 'global' | 'local'; x: number; y: number; z: number } => {
  switch (direction) {
    case 'gravity': return { system: 'global', x: 0, y: -value, z: 0 };
    case 'x': return { system: 'global', x: value, y: 0, z: 0 };
    case 'y': return { system: 'global', x: 0, y: value, z: 0 };
    case 'z': return { system: 'global', x: 0, y: 0, z: value };
    case 'local-1': return { system: 'local', x: value, y: 0, z: 0 };
    case 'local-2': return { system: 'local', x: 0, y: value, z: 0 };
    case 'local-3': return { system: 'local', x: 0, y: 0, z: value };
  }
};

const replaced = (project: Space3DProjectV1, memberIds: readonly string[], caseId: string): Space3DCommand[] => project.memberLoads
  .filter((load) => load.caseId === caseId && memberIds.includes(load.memberId))
  .map((load) => ({ kind: 'delete-member-load', loadId: load.id }));

/** Carga uniforme (o parcial) sobre cada barra elegida. */
export const space3DAssignDistributedLoadCommand = (
  project: Space3DProjectV1,
  memberIds: readonly string[],
  assignment: DistributedAssignment,
): Space3DCommand | null => {
  if (!Number.isFinite(assignment.value) || memberIds.length === 0) return null;
  const { system, x, y, z } = directionComponents(assignment.direction, assignment.value);
  const start = Math.min(1, Math.max(0, assignment.start ?? 0));
  const end = Math.min(1, Math.max(0, assignment.end ?? 1));
  if (!(end > start)) return null;
  const removals = assignment.mode === 'replace' ? replaced(project, memberIds, assignment.caseId) : [];
  const removedIds = new Set(removals.map((command) => (command.kind === 'delete-member-load' ? command.loadId : '')));
  const ids = nextIds('Q', project.memberLoads.filter((load) => !removedIds.has(load.id)).map((load) => load.id), memberIds.length);
  const additions = assignment.value === 0 ? [] : memberIds.map((memberId, index): Space3DCommand => {
    const load: Space3DMemberLoad = {
      id: ids[index], memberId, caseId: assignment.caseId, type: 'distributed', coordinateSystem: system, lengthBasis: 'real',
      start, end, qxStart: x, qxEnd: x, qyStart: y, qyEnd: y, qzStart: z, qzEnd: z,
    };
    return { kind: 'add-member-load', load };
  });
  return batch([...removals, ...additions]);
};

/** Carga puntual a una distancia relativa de cada barra elegida. */
export const space3DAssignPointMemberLoadCommand = (
  project: Space3DProjectV1,
  memberIds: readonly string[],
  assignment: { readonly caseId: string; readonly direction: Space3DMemberLoadDirection; readonly value: number; readonly position: number },
): Space3DCommand | null => {
  if (!Number.isFinite(assignment.value) || assignment.value === 0 || memberIds.length === 0) return null;
  const { system, x, y, z } = directionComponents(assignment.direction, assignment.value);
  const position = Math.min(1, Math.max(0, assignment.position));
  const ids = nextIds('P', project.memberLoads.map((load) => load.id), memberIds.length);
  return batch(memberIds.map((memberId, index): Space3DCommand => ({
    kind: 'add-member-load',
    load: { id: ids[index], memberId, caseId: assignment.caseId, type: 'point', coordinateSystem: system, lengthBasis: 'real', start: 0, end: 1, px: x, py: y, pz: z, position },
  })));
};

/** Fuerzas y momentos nodales (globales) en cada nudo elegido. */
export const space3DAssignNodalLoadCommand = (
  project: Space3DProjectV1,
  nodeIds: readonly string[],
  caseId: string,
  components: Pick<Space3DNodalLoad, 'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz'>,
  mode: 'add' | 'replace',
): Space3DCommand | null => {
  if (nodeIds.length === 0 || !Object.values(components).every(Number.isFinite)) return null;
  const removals: Space3DCommand[] = mode === 'replace'
    ? project.nodalLoads.filter((load) => load.caseId === caseId && nodeIds.includes(load.nodeId)).map((load) => ({ kind: 'delete-nodal-load', loadId: load.id }))
    : [];
  const empty = Object.values(components).every((value) => value === 0);
  const removedIds = new Set(removals.map((command) => (command.kind === 'delete-nodal-load' ? command.loadId : '')));
  const ids = nextIds('L', project.nodalLoads.filter((load) => !removedIds.has(load.id)).map((load) => load.id), nodeIds.length);
  const additions = empty ? [] : nodeIds.map((nodeId, index): Space3DCommand => ({
    kind: 'add-nodal-load',
    load: { id: ids[index], nodeId, caseId, ...components },
  }));
  return batch([...removals, ...additions]);
};

export const space3DAssignRestraintsCommand = (nodeIds: readonly string[], restraints: Space3DRestraints): Space3DCommand | null =>
  batch(nodeIds.map((nodeId) => ({ kind: 'set-restraints', nodeId, restraints })));

/**
 * Borrar la selección: barras (con sus cargas), cargas de los nudos y los
 * nudos que ya no usa ninguna barra. Un nudo que sigue sosteniendo barras no
 * elegidas se conserva y se informa.
 */
export const space3DDeleteSelectionCommand = (
  project: Space3DProjectV1,
  selection: Space3DSelectionSet,
): { readonly command: Space3DCommand | null; readonly keptNodes: readonly string[] } => {
  const members = new Set(selection.members);
  const remaining = project.members.filter((member) => !members.has(member.id));
  const used = new Set(remaining.flatMap((member) => [member.i, member.j]));
  const deletableNodes = selection.nodes.filter((id) => !used.has(id));
  const keptNodes = selection.nodes.filter((id) => used.has(id));
  const nodeLoads = project.nodalLoads.filter((load) => deletableNodes.includes(load.nodeId));
  const commands: Space3DCommand[] = [
    ...selection.members.map((memberId): Space3DCommand => ({ kind: 'delete-member', memberId })),
    ...nodeLoads.map((load): Space3DCommand => ({ kind: 'delete-nodal-load', loadId: load.id })),
    ...deletableNodes.map((nodeId): Space3DCommand => ({ kind: 'delete-node', nodeId })),
  ];
  return { command: batch(commands), keptNodes };
};

/** Barras con la misma sección que las elegidas (seleccionar «similares»). */
export const space3DMembersWithSection = (project: Space3DProjectV1, sectionKey: string): string[] =>
  project.members.filter((member) => space3DSectionKey(member) === sectionKey).map((member) => member.id);

/** Nombre de sección para agrupar: la de catálogo o «A = …» si es propia. */
export const space3DSectionKey = (member: Space3DFrameMember): string =>
  member.sectionOrigin === 'catalog' && member.sectionId ? member.sectionId : `A ${member.A.toPrecision(3)} m²`;
