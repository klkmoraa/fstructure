import { projectCommandSnapshot } from '../commands/projectCommand';
import { normalizeProject } from '../data/migrate';
import type { SyncPatchV1 } from '../shared/contracts';
import type { ProjectModel } from '../types';
import type { Space3DProjectV2 } from '../modules/space3d/space3d/public';
import { parseSpace3DDraft } from '../modules/space3d/space3d/data/codec';
import type { LinkedSpace3DBranchV1 } from '../shared/project/unifiedProjectBundle';
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
  /** Deterministic structural checksum; detects stale/tampered review DTOs but is not a cryptographic signature. */
  readonly structuralSeal: string;
}

export const SPACE3D_SYNC_ADMISSION = Object.freeze({ maxEntityCount: null, strategy: 'runtime-budget' as const });

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

const stableSerialize = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : `invalid:${String(value)}`;
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return `invalid:${typeof value}`;
};
const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
const structuralSealFor = (sourceProjectId: string, patches: readonly Space3DSyncPatchV1[]): string =>
  `structural-v1:${fnv1a(stableSerialize({ sourceProjectId, patches }))}`;

interface ReviewCapability {
  readonly canonical: string;
  readonly structuralSeal: string;
}

/**
 * A review is an in-process capability, not a portable authorization token.
 * The public seal remains a corruption diagnostic, while this registry binds
 * application to the exact review object produced by this module instance.
 */
const reviewCapabilities = new WeakMap<object, ReviewCapability>();

const deepFreeze = <T>(value: T, ancestors = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (ancestors.has(objectValue)) return value;
  ancestors.add(objectValue);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item, ancestors);
  } else {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && 'value' in descriptor) deepFreeze(descriptor.value, ancestors);
    }
  }
  ancestors.delete(objectValue);
  return Object.freeze(value);
};

const registerReviewCapability = (review: Space3DSyncReviewV1): Space3DSyncReviewV1 => {
  const immutable = deepFreeze(review);
  reviewCapabilities.set(immutable, Object.freeze({
    canonical: stableSerialize(immutable),
    structuralSeal: immutable.structuralSeal,
  }));
  return immutable;
};
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
  const editedNodes = new Map(edited.nodes.map((node) => [node.id, node]));
  const outOfPlaneNodeIds = new Set(edited.nodes.filter((node) => Math.abs(node.z) > 1e-12).map((node) => node.id));
  const baseMembers = new Map(base.members.map((member) => [member.id, member]));
  const outOfPlaneMemberIds = new Set(edited.members.filter((member) => {
    const start = editedNodes.get(member.i); const end = editedNodes.get(member.j);
    return Boolean(start && end && (outOfPlaneNodeIds.has(start.id) || outOfPlaneNodeIds.has(end.id)));
  }).map((member) => member.id));
  const addReferenceUnsupported = <T extends { readonly id: string }>(
    kind: string,
    previousItems: readonly T[],
    nextItems: readonly T[],
    outOfPlane: (item: T) => boolean,
  ) => {
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    for (const item of nextItems) {
      const previous = previousById.get(item.id);
      // A geometry change is already represented by its node/member patch. If
      // the semantic record itself changed while attached to that geometry,
      // retain the full record as explicitly unsupported instead of projecting
      // only whichever planar fields happen to survive.
      if (outOfPlane(item) && (!previous || !same(previous, item))) {
        patches.push(unsupportedPatch(kind, item.id, '$entity', previous ?? null, item));
      }
    }
  };
  for (const node of edited.nodes) {
    const previous = baseNodes.get(node.id);
    if (!previous) {
      if (Math.abs(node.z) > 1e-12) patches.push(unsupportedPatch('node', node.id, '$entity', null, node));
      for (const dof of ['uz', 'rx', 'ry'] as const) if (node.restraints[dof] !== true) patches.push(unsupportedPatch('node', node.id, `restraints.${dof}`, undefined, node.restraints[dof]));
      continue;
    }
    for (const field of ['z'] as const) if (!same(previous[field], node[field])) patches.push(unsupportedPatch('node', node.id, field, previous[field], node[field]));
    for (const dof of ['uz', 'rx', 'ry'] as const) {
      if (!same(previous.restraints[dof], node.restraints[dof])) patches.push(unsupportedPatch('node', node.id, `restraints.${dof}`, previous.restraints[dof], node.restraints[dof]));
    }
  }
  for (const member of edited.members) {
    const previous = baseMembers.get(member.id);
    const start = editedNodes.get(member.i); const end = editedNodes.get(member.j);
    if (start && end && (outOfPlaneNodeIds.has(start.id) || outOfPlaneNodeIds.has(end.id)) && (!previous || !same(previous, member))) {
      patches.push(unsupportedPatch('member', member.id, '$entity', previous ?? null, member));
    }
    if (!previous) {
      const mostlyVertical = Boolean(start && end && Math.abs(end.y - start.y) > Math.abs(end.x - start.x));
      const planarOrientation = { localYReferenceGlobal: mostlyVertical ? [0, 0, 1] : [0, 1, 0], rollRadians: 0 };
      if (!same(member.orientation, planarOrientation)) patches.push(unsupportedPatch('member', member.id, 'orientation', undefined, member.orientation));
      if (member.Iy !== 0) patches.push(unsupportedPatch('member', member.id, 'Iy', undefined, member.Iy));
      if (member.J !== 0) patches.push(unsupportedPatch('member', member.id, 'J', undefined, member.J));
      for (const field of ['iUz', 'iRx', 'iRy', 'jUz', 'jRx', 'jRy'] as const) {
        if (member.releases?.[field] !== undefined) patches.push(unsupportedPatch('member', member.id, `releases.${field}`, undefined, member.releases[field]));
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
    for (const field of ['fz', 'mx', 'my'] as const) {
      if (!same(previous?.[field] ?? 0, load[field]) && load[field] !== 0) patches.push(unsupportedPatch('nodal-load', load.id, field, previous?.[field], load[field]));
    }
  }
  addReferenceUnsupported('nodal-load', base.nodalLoads, edited.nodalLoads, (load) => outOfPlaneNodeIds.has(load.nodeId));
  addReferenceUnsupported('prescribed-displacement', base.prescribedDisplacements, edited.prescribedDisplacements, (item) => outOfPlaneNodeIds.has(item.nodeId));
  addReferenceUnsupported('member-load', base.memberLoads, edited.memberLoads, (item) => outOfPlaneMemberIds.has(item.memberId));
  addReferenceUnsupported('initial-effect', base.memberInitialEffects, edited.memberInitialEffects, (item) => outOfPlaneMemberIds.has(item.memberId));
  addReferenceUnsupported('node-link', base.nodeLinks, edited.nodeLinks, (item) => outOfPlaneNodeIds.has(item.nodeI) || (item.nodeJ !== undefined && outOfPlaneNodeIds.has(item.nodeJ)));
  addReferenceUnsupported('multi-point-constraint', base.multiPointConstraints, edited.multiPointConstraints, (item) => item.terms.some((term) => outOfPlaneNodeIds.has(term.nodeId)));
  addReferenceUnsupported('nodal-mass', base.nodalMasses, edited.nodalMasses, (item) => outOfPlaneNodeIds.has(item.nodeId));
  addReferenceUnsupported('generated-load-source', base.generatedLoadSources, edited.generatedLoadSources, (item) => item.memberIds.some((memberId) => outOfPlaneMemberIds.has(memberId)));
  addReferenceUnsupported('moving-load-case', base.movingLoadCases, edited.movingLoadCases, (item) => item.memberIds.some((memberId) => outOfPlaneMemberIds.has(memberId)) || outOfPlaneMemberIds.has(item.targetMemberId) || (item.startNodeId !== undefined && outOfPlaneNodeIds.has(item.startNodeId)));
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
    const previous = basePrescribed.get(item.id);
    if (item.component === 'uz' || item.component === 'rx' || item.component === 'ry') {
      if (!same(previous?.component, item.component)) patches.push(unsupportedPatch('prescribed-displacement', item.id, 'component', previous?.component, item.component));
    }
    if (!same(previous?.normalDirection, item.normalDirection) && item.normalDirection !== undefined) {
      patches.push(unsupportedPatch('prescribed-displacement', item.id, 'normalDirection', previous?.normalDirection, item.normalDirection));
    }
  }
  return patches;
};

/** Creates a field review against the source branch and the current 2D authority. */
export function prepareSpace3DSyncReview(source: ProjectModel, current: ProjectModel, edited: Space3DProjectV2): Space3DSyncReviewV1;
export function prepareSpace3DSyncReview(branch: LinkedSpace3DBranchV1, current: ProjectModel): Space3DSyncReviewV1;
export function prepareSpace3DSyncReview(
  sourceOrBranch: ProjectModel | LinkedSpace3DBranchV1,
  current: ProjectModel,
  editedInput?: Space3DProjectV2,
): Space3DSyncReviewV1 {
  const linked = 'model' in sourceOrBranch;
  if (linked) {
    if (typeof sourceOrBranch.sourceProjectId !== 'string' || sourceOrBranch.sourceProjectId.trim() === '') {
      throw new Error('La rama 3D tiene un sourceProjectId vacío o inválido.');
    }
    if (typeof sourceOrBranch.sourceVersion !== 'string' || sourceOrBranch.sourceVersion.trim() === '') {
      throw new Error('La rama 3D tiene un sourceVersion vacío o inválido.');
    }
    if (sourceOrBranch.baselineStatus !== 'exact' || !sourceOrBranch.sourceModel2D) {
      throw new Error('La rama 3D no conserva una base 2D exacta; es necesario volver a derivar (rederive).');
    }
    if (typeof sourceOrBranch.sourceModel2D !== 'object' || Array.isArray(sourceOrBranch.sourceModel2D)
      || sourceOrBranch.sourceModel2D.id !== sourceOrBranch.sourceProjectId) {
      throw new Error('La base 2D no coincide con sourceProjectId; la rama 3D no pertenece al mismo linaje.');
    }
    if (current.id !== sourceOrBranch.sourceProjectId) {
      throw new Error('La rama 3D no pertenece al proyecto 2D actual.');
    }
  }
  const source = structuredClone(linked ? sourceOrBranch.sourceModel2D! : sourceOrBranch);
  // Validate without replacing the exact snapshot: normalization may omit
  // optional fields and would turn representation-only differences into sync patches.
  normalizeProject(source);
  if (!linked && !editedInput) throw new Error('Falta el modelo 3D editado.');
  const edited = parseSpace3DDraft(JSON.stringify(linked ? sourceOrBranch.model : editedInput));
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
  const unsupported = unsupportedPatches(base, edited);
  const unsupportedIds = new Set(unsupported.map((patch) => patch.patchId));
  // A non-planar reference can otherwise look like a normal 2D deletion after
  // projection. Unsupported full-entity patches own that identity instead.
  const representable = representablePatches(source, current, projected).filter((patch) => !unsupportedIds.has(patch.patchId));
  const representableIds = new Set(representable.map((patch) => patch.patchId));
  const patches = [...representable, ...directRepresentablePatches(source, current, base, edited, representableIds), ...unsupported];
  return registerReviewCapability({ sourceProjectId: source.id, patches, structuralSeal: structuralSealFor(source.id, patches) });
}

const REPRESENTABLE_FIELDS: Record<SyncCollection, readonly string[]> = {
  nodes: ['$entity', 'x', 'y', 'support', 'internalHinge'],
  members: ['$entity', 'i', 'j', 'type', 'materialId', 'materialOrigin', 'sectionId', 'sectionOrigin', 'E', 'A', 'I', 'beamTheory', 'G', 'shearArea', 'density', 'releases', 'axialBehavior', 'rotationalSpringI', 'rotationalSpringJ', 'rigidOffsetI', 'rigidOffsetJ', 'label'],
  loadCases: ['$entity', 'name', 'category', 'active', 'selfWeightFactor'],
  combinations: ['$entity', 'name', 'factors', 'source', 'sourceUrl', 'jurisdiction', 'edition', 'stateLimit', 'reviewedAt'],
  nodalLoads: ['$entity', 'nodeId', 'caseId', 'fx', 'fy', 'mz'],
  prescribedDisplacements: ['$entity', 'nodeId', 'caseId', 'component', 'value'],
  memberLoads: ['$entity', 'memberId', 'caseId', 'type', 'coordinateSystem', 'lengthBasis', 'start', 'end', 'qxStart', 'qxEnd', 'qyStart', 'qyEnd', 'px', 'py', 'moment', 'position'],
  memberInitialEffects: ['$entity', 'memberId', 'caseId', 'type', 'alpha', 'deltaT', 'gradient', 'axialStrain', 'curvature'],
  nodeLinks: ['$entity', 'nodeI', 'nodeJ', 'behavior', 'angleDeg', 'stiffness', 'clearance', 'slipForce', 'label'],
  multiPointConstraints: ['$entity', 'terms', 'value', 'label'],
  nodalMasses: ['$entity', 'nodeId', 'mass', 'rotationalInertia', 'label'],
  generatedLoadSources: ['$entity', 'kind', 'caseId', 'memberIds', 'pressure', 'tributaryWidth', 'direction', 'referenceY', 'unitWeight', 'pressureAtReference', 'sign', 'stiffness', 'qx', 'qy', 'coordinateSystem', 'lengthBasis', 'pattern', 'force', 'eccentricity', 'label'],
  movingLoadCases: ['$entity', 'name', 'memberIds', 'targetMemberId', 'targetPosition', 'quantity', 'startNodeId', 'impactFactor', 'axles'],
};
const COLLECTION_KIND = new Map(COLLECTIONS.map(({ collection, entityKind }) => [collection, entityKind]));
const UNSUPPORTED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  node: ['$entity', 'z', 'restraints.uz', 'restraints.rx', 'restraints.ry'],
  member: ['$entity', 'Iy', 'J', 'orientation', 'releases.iUz', 'releases.iRx', 'releases.iRy', 'releases.jUz', 'releases.jRx', 'releases.jRy'],
  'nodal-load': ['$entity', 'fz', 'mx', 'my'],
  'member-load': ['$entity', 'qzStart', 'qzEnd', 'pz', 'mx', 'my', 'mz'],
  'initial-effect': ['$entity', 'gradientY', 'gradientZ', 'curvatureY', 'curvatureZ'],
  'node-link': ['$entity', 'direction.z'], 'multi-point-constraint': ['$entity', 'outOfPlaneTerms'],
  'nodal-mass': ['$entity', 'massX', 'massY', 'massZ', 'inertiaX', 'inertiaY', 'inertiaZ'],
  'generated-load-source': ['$entity', 'direction', 'qz'], 'prescribed-displacement': ['$entity', 'component', 'normalDirection'],
  'moving-load-case': ['$entity'],
};
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const assertPlainData = (value: unknown, path: string, ancestors = new WeakSet<object>()): void => {
  if (value === null || value === undefined || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value !== 'object') throw new Error(`${path} contiene un valor no serializable.`);
  if (ancestors.has(value)) throw new Error(`${path} contiene una referencia cíclica.`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length) throw new Error(`${path} debe ser una lista JSON sin prototype personalizado.`);
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || keys.some((key) => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)))) throw new Error(`${path} debe ser una lista JSON densa.`);
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error(`${path}[${index}] debe ser un dato JSON enumerable.`);
        assertPlainData(descriptor.value, `${path}[${index}]`, ancestors);
      }
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path} debe ser un objeto plano sin prototype personalizado.`);
    if (Object.getOwnPropertySymbols(value).length) throw new Error(`${path} contiene símbolos.`);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (FORBIDDEN_KEYS.has(key) || !('value' in descriptor) || !descriptor.enumerable) throw new Error(`${path}.${key} no es un campo de datos permitido.`);
      assertPlainData(descriptor.value, `${path}.${key}`, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
};
const isEntityRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactObjectKeys = (value: object, required: readonly string[], optional: readonly string[], path: string) => {
  const keys = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) throw new Error(`${path} tiene campos fuera del contrato.`);
};
const validateReviewEnvelope = (review: Space3DSyncReviewV1): void => {
  assertPlainData(review, 'review');
  exactObjectKeys(review, ['sourceProjectId', 'patches', 'structuralSeal'], [], 'review');
  if (typeof review.sourceProjectId !== 'string' || review.sourceProjectId.trim() === '' || !Array.isArray(review.patches) || typeof review.structuralSeal !== 'string' || !/^structural-v1:[0-9a-f]{8}$/.test(review.structuralSeal)) throw new Error('La revisión tiene un contrato inválido.');
  const seen = new Set<string>();
  for (const patch of review.patches) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('La revisión contiene un parche inválido.');
    exactObjectKeys(patch, ['patchId', 'entityKind', 'entityId', 'field', 'before', 'after', 'compatibility', 'state'], ['targetCollection'], 'review.patch');
    if (typeof patch.entityKind !== 'string' || typeof patch.entityId !== 'string' || patch.entityId.trim() === '' || typeof patch.field !== 'string' || patch.field.trim() === '' || typeof patch.patchId !== 'string' || patch.patchId.trim() === '') throw new Error('La revisión contiene un parche inválido.');
    if (patch.patchId !== patchIdFor(patch.entityKind, patch.entityId, patch.field) || seen.has(patch.patchId)) throw new Error('La revisión contiene IDs de parche alterados o duplicados.');
    seen.add(patch.patchId);
    if (patch.field === '$entity') {
      const beforeIsRecord = isEntityRecord(patch.before);
      const afterIsRecord = isEntityRecord(patch.after);
      if ((patch.before !== null && !beforeIsRecord) || (patch.after !== null && !afterIsRecord)
        || (patch.before === null && patch.after === null)
        || (beforeIsRecord && (patch.before as Record<string, unknown>).id !== patch.entityId)
        || (afterIsRecord && (patch.after as Record<string, unknown>).id !== patch.entityId)) {
        throw new Error('La revisión contiene una operación $entity con identidad antes/después inválida.');
      }
    }
    const hasTargetCollection = Object.hasOwn(patch, 'targetCollection');
    if (patch.compatibility === 'unsupported') {
      if (patch.state !== 'unsupported' || hasTargetCollection || !UNSUPPORTED_FIELDS[patch.entityKind]?.includes(patch.field)) throw new Error('La revisión contiene una tupla unsupported fuera del contrato.');
    } else {
      if (patch.compatibility !== 'exact' && patch.compatibility !== 'requires-review') throw new Error('La revisión contiene compatibilidad inválida.');
      if (patch.state !== 'ready' && patch.state !== 'conflict') throw new Error('La revisión contiene estado inválido.');
      if (patch.entityKind === 'project') {
        if (hasTargetCollection || patch.field !== 'name' || patch.entityId !== review.sourceProjectId) throw new Error('La revisión contiene una tupla de proyecto inválida.');
      } else {
        const collection = patch.targetCollection as SyncCollection | undefined;
        if (!hasTargetCollection || !collection || COLLECTION_KIND.get(collection) !== patch.entityKind || !REPRESENTABLE_FIELDS[collection].includes(patch.field)) throw new Error('La revisión contiene una tupla 2D fuera del contrato.');
      }
    }
  }
  if (review.structuralSeal !== structuralSealFor(review.sourceProjectId, review.patches)) throw new Error('El sello estructural de la revisión fue alterado.');
};

const requireReviewCapability = (review: Space3DSyncReviewV1): void => {
  const capability = reviewCapabilities.get(review);
  if (!capability) {
    throw new Error('La revisión no tiene una capacidad local de este proceso; debe regenerarse antes de aplicar.');
  }
  if (capability.canonical !== stableSerialize(review) || capability.structuralSeal !== review.structuralSeal) {
    throw new Error('La revisión local fue alterada; debe regenerarse antes de aplicar.');
  }
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
  validateReviewEnvelope(review);
  requireReviewCapability(review);
  if (current.id !== review.sourceProjectId) throw new Error('La revisión no pertenece al proyecto 2D actual.');
  assertPlainData(approvedPatchIds, 'approvedPatchIds');
  if (!Array.isArray(approvedPatchIds) || approvedPatchIds.some((id) => typeof id !== 'string' || id.trim() === '')) throw new Error('La aprobación contiene IDs inválidos.');
  if (new Set(approvedPatchIds).size !== approvedPatchIds.length) throw new Error('La aprobación contiene IDs de parche duplicados.');
  const byId = new Map(review.patches.map((patch) => [patch.patchId, patch]));
  if (byId.size !== review.patches.length) throw new Error('La revisión contiene IDs de parche duplicados.');
  const selected = approvedPatchIds.map((id) => {
    const patch = byId.get(id);
    if (!patch) throw new Error(`Parche aprobado desconocido: ${id}.`);
    if (patch.compatibility === 'unsupported') throw new Error(`El parche ${id} es unsupported y no puede aprobarse.`);
    if (patch.state !== 'ready') throw new Error(`Falló la precondición para ${patch.entityKind}/${patch.entityId}/${patch.field}.`);
    return patch;
  });

  for (const patch of selected) {
    if (patch.state === 'conflict') throw new Error(`Falló la precondición para ${patch.entityKind}/${patch.entityId}/${patch.field}.`);
    if (patch.entityKind === 'project') {
      if (!same(current.name, patch.before)) throw new Error('Falló la precondición para project/name.');
      continue;
    }
    const collection = patch.targetCollection;
    if (!collection) throw new Error(`El parche ${patch.patchId} no declara destino 2D.`);
    const entity = row(current, collection, patch.entityId);
    if (patch.field !== '$entity' && !entity) throw new Error(`Falló la precondición para ${collection}/${patch.entityId}/${patch.field}.`);
    const actual = patch.field === '$entity' ? entity : entity?.[patch.field];
    if (!same(actual, patch.before)) throw new Error(`Falló la precondición para ${collection}/${patch.entityId}/${patch.field}.`);
    if (patch.field === '$entity' && patch.before === null && patch.after === null) throw new Error(`El parche ${patch.patchId} no describe una operación válida.`);
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
      if (patch.after === null) {
        if (index < 0) throw new Error(`El parche ${patch.patchId} no encuentra la entidad que debe eliminar.`);
        collectionRows.splice(index, 1);
      }
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
