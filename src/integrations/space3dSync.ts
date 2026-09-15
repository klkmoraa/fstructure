import { projectCommandSnapshot } from '../commands/projectCommand';
import { normalizeProject } from '../data/migrate';
import type { SyncPatchV1 } from '../shared/contracts';
import type { ProjectModel } from '../types';
import type { Space3DProjectV2 } from '../modules/space3d/space3d/public';
import { buildPlanar2DToSpace3DHandoff, roundTripPlanarSpace3DTo2D } from './planar2dToSpace3d';

type SyncCollection = 'nodes' | 'members' | 'loadCases' | 'combinations' | 'nodalLoads'
  | 'prescribedDisplacements' | 'memberLoads' | 'memberInitialEffects' | 'nodeLinks'
  | 'multiPointConstraints' | 'nodalMasses' | 'generatedLoadSources' | 'movingLoadCases';

export interface Space3DSyncPatchV1 extends SyncPatchV1 {
  readonly patchId: string;
  readonly state: 'ready' | 'conflict' | 'unsupported';
  readonly targetCollection?: SyncCollection;
}

export interface Space3DSyncReviewV1 {
  readonly sourceProjectId: string;
  readonly patches: readonly Space3DSyncPatchV1[];
}

const COLLECTIONS: readonly { collection: SyncCollection; entityKind: string }[] = [
  { collection: 'nodes', entityKind: 'node' },
  { collection: 'members', entityKind: 'member' },
  { collection: 'loadCases', entityKind: 'case' },
  { collection: 'combinations', entityKind: 'combination' },
  { collection: 'nodalLoads', entityKind: 'nodal-load' },
  { collection: 'prescribedDisplacements', entityKind: 'prescribed-displacement' },
  { collection: 'memberLoads', entityKind: 'member-load' },
  { collection: 'memberInitialEffects', entityKind: 'initial-effect' },
  { collection: 'nodeLinks', entityKind: 'node-link' },
  { collection: 'multiPointConstraints', entityKind: 'multi-point-constraint' },
  { collection: 'nodalMasses', entityKind: 'nodal-mass' },
  { collection: 'generatedLoadSources', entityKind: 'generated-load-source' },
  { collection: 'movingLoadCases', entityKind: 'moving-load-case' },
];

const same = (left: unknown, right: unknown): boolean => projectCommandSnapshot(left) === projectCommandSnapshot(right);
const patchIdFor = (entityKind: string, entityId: string, field: string): string => JSON.stringify([entityKind, entityId, field]);
const rows = (project: ProjectModel, collection: SyncCollection): readonly Record<string, unknown>[] =>
  ((project[collection] ?? []) as readonly unknown[]) as readonly Record<string, unknown>[];
const row = (project: ProjectModel, collection: SyncCollection, id: string): Record<string, unknown> | null =>
  rows(project, collection).find((candidate) => candidate.id === id) ?? null;

const compatibilityFor = (entityKind: string, field: string): SyncPatchV1['compatibility'] => {
  if (field === '$entity' || (entityKind === 'member' && (field === 'i' || field === 'j' || field === 'type')) || (entityKind === 'node' && field === 'support')) {
    return 'requires-review';
  }
  return 'exact';
};

const representablePatches = (source: ProjectModel, current: ProjectModel, projected: ProjectModel): Space3DSyncPatchV1[] => {
  const patches: Space3DSyncPatchV1[] = [];
  for (const { collection, entityKind } of COLLECTIONS) {
    const beforeById = new Map(rows(source, collection).map((entity) => [String(entity.id), entity]));
    const afterById = new Map(rows(projected, collection).map((entity) => [String(entity.id), entity]));
    const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
    for (const id of ids) {
      const beforeEntity = beforeById.get(id) ?? null;
      const afterEntity = afterById.get(id) ?? null;
      if (!beforeEntity || !afterEntity) {
        const currentEntity = row(current, collection, id);
        patches.push({
          patchId: patchIdFor(entityKind, id, '$entity'), entityKind, entityId: id, field: '$entity',
          before: structuredClone(beforeEntity), after: structuredClone(afterEntity), compatibility: 'requires-review',
          state: same(currentEntity, beforeEntity) ? 'ready' : 'conflict', targetCollection: collection,
        });
        continue;
      }
      const fields = [...new Set([...Object.keys(beforeEntity), ...Object.keys(afterEntity)])].filter((field) => field !== 'id').sort();
      for (const field of fields) {
        if (same(beforeEntity[field], afterEntity[field])) continue;
        const currentEntity = row(current, collection, id);
        const currentValue = currentEntity?.[field];
        patches.push({
          patchId: patchIdFor(entityKind, id, field), entityKind, entityId: id, field,
          before: structuredClone(beforeEntity[field]), after: structuredClone(afterEntity[field]),
          compatibility: compatibilityFor(entityKind, field),
          state: currentEntity && same(currentValue, beforeEntity[field]) ? 'ready' : 'conflict',
          targetCollection: collection,
        });
      }
    }
  }
  if (source.name !== projected.name) {
    patches.push({
      patchId: patchIdFor('project', source.id, 'name'), entityKind: 'project', entityId: source.id, field: 'name',
      before: source.name, after: projected.name, compatibility: 'exact',
      state: current.name === source.name ? 'ready' : 'conflict',
    });
  }
  return patches;
};

const directRepresentablePatches = (
  source: ProjectModel,
  current: ProjectModel,
  base: Space3DProjectV2,
  edited: Space3DProjectV2,
  existingIds: ReadonlySet<string>,
): Space3DSyncPatchV1[] => {
  const patches: Space3DSyncPatchV1[] = [];
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  for (const node of edited.nodes) {
    const previous = baseNodes.get(node.id);
    const sourceNode = source.nodes.find((item) => item.id === node.id);
    const currentNode = current.nodes.find((item) => item.id === node.id);
    if (!previous || !sourceNode || !currentNode) continue;
    const before = [previous.restraints.ux, previous.restraints.uy, previous.restraints.rz];
    const after = [node.restraints.ux, node.restraints.uy, node.restraints.rz];
    const patchId = patchIdFor('node', node.id, 'support');
    if (!same(before, after) && !existingIds.has(patchId)) {
      patches.push({
        patchId, entityKind: 'node', entityId: node.id, field: 'support',
        before: structuredClone(sourceNode.support),
        after: { type: 'custom', restrainX: node.restraints.ux, restrainY: node.restraints.uy, restrainR: node.restraints.rz },
        compatibility: 'requires-review', state: same(currentNode.support, sourceNode.support) ? 'ready' : 'conflict', targetCollection: 'nodes',
      });
    }
  }
  const baseMembers = new Map(base.members.map((member) => [member.id, member]));
  for (const member of edited.members) {
    const previous = baseMembers.get(member.id);
    const sourceMember = source.members.find((item) => item.id === member.id);
    const currentMember = current.members.find((item) => item.id === member.id);
    const patchId = patchIdFor('member', member.id, 'G');
    if (!previous || !sourceMember || !currentMember || same(previous.G, member.G) || existingIds.has(patchId)) continue;
    patches.push({
      patchId, entityKind: 'member', entityId: member.id, field: 'G', before: sourceMember.G, after: member.G,
      compatibility: 'exact', state: same(currentMember.G, sourceMember.G) ? 'ready' : 'conflict', targetCollection: 'members',
    });
  }
  return patches;
};

const unsupportedPatch = (entityKind: string, entityId: string, field: string, before: unknown, after: unknown): Space3DSyncPatchV1 => ({
  patchId: patchIdFor(entityKind, entityId, field),
  entityKind, entityId, field,
  before: structuredClone(before), after: structuredClone(after),
  compatibility: 'unsupported', state: 'unsupported',
});

const unsupportedPatches = (base: Space3DProjectV2, edited: Space3DProjectV2): Space3DSyncPatchV1[] => {
  const patches: Space3DSyncPatchV1[] = [];
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  for (const node of edited.nodes) {
    const previous = baseNodes.get(node.id);
    if (!previous) {
      if (Math.abs(node.z) > 1e-12) patches.push(unsupportedPatch('node', node.id, '$entity', null, node));
      continue;
    }
    for (const field of ['z'] as const) if (!same(previous[field], node[field])) patches.push(unsupportedPatch('node', node.id, field, previous[field], node[field]));
    for (const dof of ['uz', 'rx', 'ry'] as const) {
      if (!same(previous.restraints[dof], node.restraints[dof])) patches.push(unsupportedPatch('node', node.id, `restraints.${dof}`, previous.restraints[dof], node.restraints[dof]));
    }
  }
  const baseMembers = new Map(base.members.map((member) => [member.id, member]));
  for (const member of edited.members) {
    const previous = baseMembers.get(member.id);
    if (!previous) {
      const nodes = new Map(edited.nodes.map((node) => [node.id, node]));
      if (Math.abs(nodes.get(member.i)?.z ?? 0) > 1e-12 || Math.abs(nodes.get(member.j)?.z ?? 0) > 1e-12) {
        patches.push(unsupportedPatch('member', member.id, '$entity', null, member));
      }
      continue;
    }
    for (const field of ['Iy', 'J', 'orientation'] as const) {
      if (!same(previous[field], member[field])) patches.push(unsupportedPatch('member', member.id, field, previous[field], member[field]));
    }
    for (const field of ['iUz', 'iRx', 'iRy', 'jUz', 'jRx', 'jRy'] as const) {
      if (!same(previous.releases?.[field], member.releases?.[field])) patches.push(unsupportedPatch('member', member.id, `releases.${field}`, previous.releases?.[field], member.releases?.[field]));
    }
  }
  const baseLoads = new Map(base.nodalLoads.map((load) => [load.id, load]));
  for (const load of edited.nodalLoads) {
    const previous = baseLoads.get(load.id);
    if (!previous) continue;
    for (const field of ['fz', 'mx', 'my'] as const) {
      if (!same(previous[field], load[field])) patches.push(unsupportedPatch('nodal-load', load.id, field, previous[field], load[field]));
    }
  }
  const compareUnsupportedFields = <T extends { readonly id: string }>(
    kind: string,
    previousItems: readonly T[],
    nextItems: readonly T[],
    fields: readonly string[],
  ) => {
    const previousById = new Map(previousItems.map((item) => [item.id, item as unknown as Record<string, unknown>]));
    for (const item of nextItems) {
      const before = previousById.get(item.id);
      const after = item as unknown as Record<string, unknown>;
      for (const field of fields) {
        if (!same(before?.[field], after[field])) patches.push(unsupportedPatch(kind, item.id, field, before?.[field], after[field]));
      }
    }
  };
  compareUnsupportedFields('member-load', base.memberLoads, edited.memberLoads, ['qzStart', 'qzEnd', 'pz', 'mx', 'my', 'mz']);
  compareUnsupportedFields('initial-effect', base.memberInitialEffects, edited.memberInitialEffects, ['gradientY', 'gradientZ', 'curvatureY', 'curvatureZ']);
  compareUnsupportedFields('nodal-mass', base.nodalMasses, edited.nodalMasses, ['massX', 'massY', 'massZ', 'inertiaX', 'inertiaY', 'inertiaZ']);
  const baseLinks = new Map(base.nodeLinks.map((item) => [item.id, item]));
  for (const item of edited.nodeLinks) {
    const previous = baseLinks.get(item.id);
    if (!previous || !same(previous.direction[2], item.direction[2])) {
      if (Math.abs(item.direction[2]) > 1e-12) patches.push(unsupportedPatch('node-link', item.id, 'direction.z', previous?.direction[2], item.direction[2]));
    }
  }
  const baseMpcs = new Map(base.multiPointConstraints.map((item) => [item.id, item]));
  for (const item of edited.multiPointConstraints) {
    const outOfPlane = item.terms.filter((term) => term.component === 'uz' || term.component === 'rx' || term.component === 'ry');
    const previous = baseMpcs.get(item.id)?.terms.filter((term) => term.component === 'uz' || term.component === 'rx' || term.component === 'ry') ?? [];
    if (!same(previous, outOfPlane)) patches.push(unsupportedPatch('multi-point-constraint', item.id, 'outOfPlaneTerms', previous, outOfPlane));
  }
  const baseGenerated = new Map(base.generatedLoadSources.map((item) => [item.id, item]));
  for (const item of edited.generatedLoadSources) {
    const previous = baseGenerated.get(item.id);
    if (item.direction === 'global-z' && previous?.direction !== 'global-z') patches.push(unsupportedPatch('generated-load-source', item.id, 'direction', previous?.direction, item.direction));
    if (!same(previous?.qz, item.qz)) patches.push(unsupportedPatch('generated-load-source', item.id, 'qz', previous?.qz, item.qz));
  }
  const basePrescribed = new Map(base.prescribedDisplacements.map((item) => [item.id, item]));
  for (const item of edited.prescribedDisplacements) {
    if (item.component !== 'uz' && item.component !== 'rx' && item.component !== 'ry') continue;
    patches.push(unsupportedPatch('prescribed-displacement', item.id, 'component', basePrescribed.get(item.id)?.component, item.component));
  }
  return patches;
};

/** Creates a field review against the source branch and the current 2D authority. */
export const prepareSpace3DSyncReview = (
  source: ProjectModel,
  current: ProjectModel,
  edited: Space3DProjectV2,
): Space3DSyncReviewV1 => {
  if (source.id !== current.id || edited.id !== `space3d:${source.id}`) {
    throw new Error('La rama 3D no pertenece al proyecto 2D actual.');
  }
  const spatialCollections: readonly [string, readonly { readonly id: string }[]][] = [
    ['nodes', edited.nodes], ['members', edited.members], ['nodalLoads', edited.nodalLoads],
    ['loadCases', edited.loadCases], ['loadCombinations', edited.loadCombinations],
    ['prescribedDisplacements', edited.prescribedDisplacements], ['memberLoads', edited.memberLoads],
    ['memberInitialEffects', edited.memberInitialEffects], ['nodeLinks', edited.nodeLinks],
    ['multiPointConstraints', edited.multiPointConstraints], ['nodalMasses', edited.nodalMasses],
    ['generatedLoadSources', edited.generatedLoadSources], ['movingLoadCases', edited.movingLoadCases],
  ];
  for (const [collection, entities] of spatialCollections) {
    const ids = entities.map((entity) => entity.id);
    if (ids.some((id) => typeof id !== 'string' || id === '') || new Set(ids).size !== ids.length) {
      throw new Error(`La rama 3D contiene IDs inválidos o duplicados en ${collection}.`);
    }
  }
  const projected = roundTripPlanarSpace3DTo2D(edited, source);
  const base = buildPlanar2DToSpace3DHandoff(source).candidateModel;
  const representable = representablePatches(source, current, projected);
  const representableIds = new Set(representable.map((patch) => patch.patchId));
  return {
    sourceProjectId: source.id,
    patches: [...representable, ...directRepresentablePatches(source, current, base, edited, representableIds), ...unsupportedPatches(base, edited)],
  };
};

const requireUniqueIds = (project: ProjectModel, collection: SyncCollection): void => {
  const ids = rows(project, collection).map((entity) => entity.id);
  if (ids.some((id) => typeof id !== 'string' || id === '') || new Set(ids).size !== ids.length) {
    throw new Error(`La sincronización produciría IDs inválidos o duplicados en ${collection}.`);
  }
};

/** Validates every approved precondition before mutating the clone, so rejection is atomic. */
export const applyApprovedSpace3DSync = (
  current: ProjectModel,
  review: Space3DSyncReviewV1,
  approvedPatchIds: readonly string[],
): ProjectModel => {
  if (current.id !== review.sourceProjectId) throw new Error('La revisión no pertenece al proyecto 2D actual.');
  if (new Set(approvedPatchIds).size !== approvedPatchIds.length) throw new Error('La aprobación contiene IDs de parche duplicados.');
  const byId = new Map(review.patches.map((patch) => [patch.patchId, patch]));
  if (byId.size !== review.patches.length) throw new Error('La revisión contiene IDs de parche duplicados.');
  const selected = approvedPatchIds.map((id) => {
    const patch = byId.get(id);
    if (!patch) throw new Error(`Parche aprobado desconocido: ${id}.`);
    return patch;
  }).filter((patch) => patch.compatibility !== 'unsupported');

  for (const patch of selected) {
    if (patch.state === 'conflict') throw new Error(`Falló la precondición para ${patch.entityKind}/${patch.entityId}/${patch.field}.`);
    if (patch.entityKind === 'project') {
      if (!same(current.name, patch.before)) throw new Error('Falló la precondición para project/name.');
      continue;
    }
    const collection = patch.targetCollection;
    if (!collection) throw new Error(`El parche ${patch.patchId} no declara destino 2D.`);
    const entity = row(current, collection, patch.entityId);
    const actual = patch.field === '$entity' ? entity : entity?.[patch.field];
    if (!same(actual, patch.before)) throw new Error(`Falló la precondición para ${collection}/${patch.entityId}/${patch.field}.`);
  }

  const next = structuredClone(current);
  for (const patch of selected) {
    if (patch.entityKind === 'project') {
      next.name = String(patch.after);
      continue;
    }
    const collection = patch.targetCollection!;
    const collectionRows = [...rows(next, collection)] as Record<string, unknown>[];
    const index = collectionRows.findIndex((entity) => entity.id === patch.entityId);
    if (patch.field === '$entity') {
      if (patch.after === null) collectionRows.splice(index, 1);
      else if (index < 0) collectionRows.push(structuredClone(patch.after) as Record<string, unknown>);
      else collectionRows[index] = structuredClone(patch.after) as Record<string, unknown>;
    } else {
      const entity = { ...collectionRows[index] };
      if (patch.after === undefined) delete entity[patch.field];
      else entity[patch.field] = structuredClone(patch.after);
      collectionRows[index] = entity;
    }
    (next as unknown as Record<string, unknown>)[collection] = collectionRows;
  }
  for (const { collection } of COLLECTIONS) requireUniqueIds(next, collection);
  return normalizeProject(next);
};
