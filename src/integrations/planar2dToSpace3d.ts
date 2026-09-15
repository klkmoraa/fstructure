import type { ProjectModel, SupportDefinition } from '../types';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember,
  type Space3DNodalLoad,
  type Space3DProjectV1,
  type Space3DRestraints,
} from '../modules/space3d/space3d/public';
import type {
  Planar2DToSpace3DHandoffV1,
  Planar2DToSpace3DMapping,
  Space3DBridgeNote,
} from '../modules/space3d/integrations/planar2dToSpace3d';

const finitePositive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isAxisAlignedRoller = (support: SupportDefinition): boolean => {
  if (support.type !== 'roller') return true;
  const angle = support.angleDeg ?? 90;
  if (!Number.isFinite(angle)) return false;
  const normalized = ((angle % 180) + 180) % 180;
  const tolerance = 1e-7;
  return Math.min(normalized, 180 - normalized) <= tolerance
    || Math.abs(normalized - 90) <= tolerance;
};

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * Keep the source fingerprint independent of object insertion order. The 2D
 * project is mutable and can be rebuilt from persistence, so plain
 * JSON.stringify could produce different references for the same source or
 * hide a transition to an undefined/non-finite value.
 */
const stableSerialize = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (value === Number.POSITIVE_INFINITY) return 'number:Infinity';
    if (value === Number.NEGATIVE_INFINITY) return 'number:-Infinity';
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`;
  }
  return `${typeof value}:${String(value)}`;
};

const planarRestraints = (support: SupportDefinition): Space3DRestraints => {
  let ux = support.restrainX ?? false;
  let uy = support.restrainY ?? false;
  let rz = support.restrainR ?? false;
  if (support.type === 'fixed') ux = uy = rz = true;
  if (support.type === 'pin') { ux = true; uy = true; rz = false; }
  if (support.type === 'roller') {
    const angle = (support.angleDeg ?? 90) * Math.PI / 180;
    ux = Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle));
    uy = !ux;
    rz = false;
  }
  return { ux, uy, rz, uz: true, rx: true, ry: true };
};

const orientationFor = (project: ProjectModel, member: ProjectModel['members'][number]) => {
  const start = project.nodes.find((node) => node.id === member.i);
  const end = project.nodes.find((node) => node.id === member.j);
  const mostlyVertical = Boolean(start && end && Math.abs(end.y - start.y) > Math.abs(end.x - start.x));
  return { localYReferenceGlobal: mostlyVertical ? [0, 0, 1] as const : [0, 1, 0] as const, rollRadians: 0 };
};

export const buildPlanar2DToSpace3DHandoff = (project: ProjectModel): Planar2DToSpace3DHandoffV1 => {
  const mappings: Planar2DToSpace3DMapping[] = [];
  const notes: Space3DBridgeNote[] = [];
  const addNote = (
    code: Space3DBridgeNote['code'],
    classification: Space3DBridgeNote['classification'],
    entityKind: Space3DBridgeNote['entityKind'],
    entityId: string,
    field: string,
    blocking: boolean,
    hypothesis?: number,
  ) => {
    const base = {
      id: `${code}:${entityKind}:${entityId}:${field}`,
      code,
      classification,
      source: { entityKind, entityId, field },
      target: entityKind === 'node' || entityKind === 'member' ? { entityKind, entityId, field } : null,
      entityKind,
      entityId,
      field,
      blocking,
    } satisfies Space3DBridgeNote;
    notes.push(hypothesis === undefined ? base : { ...base, hypothesis });
  };

  const nodes = project.nodes.map((node) => {
    mappings.push({ id: `node:${node.id}`, source: { entityKind: 'node', entityId: node.id }, target: { entityKind: 'node', entityId: node.id }, disposition: 'transformed' });
    if (node.support.spring) addNote('dropped-support-spring', 'omitted-semantics', 'node', node.id, 'support.spring', true);
    if (node.support.prescribed) addNote('dropped-prescribed-support-motion', 'omitted-semantics', 'node', node.id, 'support.prescribed', true);
    if (!isAxisAlignedRoller(node.support)) addNote('dropped-inclined-support', 'omitted-semantics', 'node', node.id, 'support.angleDeg', true);
    if (node.internalHinge) addNote('dropped-internal-hinge', 'omitted-semantics', 'node', node.id, 'internalHinge', true);
    return { id: node.id, x: node.x, y: node.y, z: 0, restraints: planarRestraints(node.support) };
  });

  const members: Space3DFrameMember[] = project.members.map((member) => {
    mappings.push({ id: `member:${member.id}`, source: { entityKind: 'member', entityId: member.id }, target: { entityKind: 'member', entityId: member.id }, disposition: member.type === 'frame' ? 'preserved' : 'transformed' });
    const G = finitePositive(member.G) ? member.G : member.E / 2.6;
    const Iy = member.I;
    const J = finitePositive(member.I) ? Math.max(member.I * 0.1, Number.EPSILON) : member.I * 0.1;
    if (!finitePositive(member.G)) addNote('pending-shear-modulus', 'missing-required-property', 'member', member.id, 'G', true, G);
    addNote('pending-weak-axis-inertia', 'missing-required-property', 'member', member.id, 'Iy', true, Iy);
    addNote('pending-torsion-constant', 'missing-required-property', 'member', member.id, 'J', true, J);
    if (member.type === 'truss') addNote('truss-member-as-frame', 'changed-semantics', 'member', member.id, 'type', true);
    if (member.type === 'rigid') addNote('dropped-rigid-member', 'changed-semantics', 'member', member.id, 'type', true);
    if (member.axialBehavior !== undefined && member.axialBehavior !== 'both') {
      addNote('dropped-axial-behavior', 'changed-semantics', 'member', member.id, 'axialBehavior', true);
    }
    if (member.beamTheory === 'timoshenko') addNote('dropped-timoshenko-theory', 'changed-semantics', 'member', member.id, 'beamTheory', true);
    if (member.shearArea !== undefined) addNote('dropped-shear-area', 'omitted-semantics', 'member', member.id, 'shearArea', true);
    if (member.releases && Object.values(member.releases).some(Boolean)) addNote('dropped-member-release', 'omitted-semantics', 'member', member.id, 'releases', true);
    if (member.rotationalSpringI !== undefined || member.rotationalSpringJ !== undefined) addNote('dropped-semi-rigid-connection', 'omitted-semantics', 'member', member.id, 'rotationalSpring', true);
    if (member.rigidOffsetI || member.rigidOffsetJ) addNote('dropped-rigid-offset', 'omitted-semantics', 'member', member.id, 'rigidOffset', true);
    return {
      id: member.id,
      i: member.i,
      j: member.j,
      E: member.E,
      G,
      A: member.A,
      Iy,
      Iz: member.I,
      J,
      orientation: orientationFor(project, member),
    };
  });

  const nodalLoads: Space3DNodalLoad[] = project.nodalLoads.map((load) => {
    mappings.push({ id: `load:${load.id}`, source: { entityKind: 'load', entityId: load.id }, target: { entityKind: 'load', entityId: load.id }, disposition: 'transformed' });
    return { id: load.id, caseId: load.caseId, nodeId: load.nodeId, fx: load.fx, fy: load.fy, fz: 0, mx: 0, my: 0, mz: load.mz };
  });

  const omittedGroups: readonly [keyof ProjectModel, Space3DBridgeNote['code'], Space3DBridgeNote['entityKind']][] = [
    ['memberLoads', 'dropped-member-load', 'member-load'],
    ['prescribedDisplacements', 'dropped-prescribed-displacement', 'prescribed-displacement'],
    ['memberInitialEffects', 'dropped-initial-effect', 'initial-effect'],
    ['nodeLinks', 'dropped-node-link', 'node-link'],
    ['multiPointConstraints', 'dropped-multi-point-constraint', 'multi-point-constraint'],
    ['nodalMasses', 'dropped-nodal-mass', 'nodal-mass'],
    ['generatedLoadSources', 'dropped-generated-load-source', 'generated-load-source'],
    ['movingLoadCases', 'dropped-moving-load-case', 'moving-load-case'],
  ];
  for (const [field, code, kind] of omittedGroups) {
    const entries = project[field];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries as readonly { id: string }[]) {
      mappings.push({ id: `omitted:${kind}:${entry.id}`, source: { entityKind: kind, entityId: entry.id }, target: null, disposition: 'omitted' });
      addNote(code, 'omitted-semantics', kind, entry.id, field, true);
    }
  }

  // Space 3D-1 has no self-weight factor on a load case and therefore cannot
  // reproduce a non-zero 2D self-weight contribution by merely copying the
  // case id/name. Keep the omission visible and blocking, including malformed
  // non-finite values that must never disappear during a handoff.
  for (const loadCase of project.loadCases) {
    if (loadCase.selfWeightFactor !== undefined && loadCase.selfWeightFactor !== 0) {
      addNote('dropped-self-weight', 'omitted-semantics', 'case', loadCase.id, 'selfWeightFactor', true);
    }
  }

  const candidateModel: Space3DProjectV1 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: `space3d:${project.id}`,
    name: project.name,
    // Project values are stored canonically in kN and m. The display unit
    // selected in the 2D settings must not relabel those numbers as N-mm,
    // kip-ft, etc. in the Space 3D candidate.
    units: 'kN-m',
    nodes,
    members,
    nodalLoads,
    loadCases: project.loadCases.map(({ id, name }) => ({ id, name })),
    loadCombinations: project.combinations.map(({ id, name, factors }) => ({
      id,
      name,
      terms: Object.entries(factors).map(([caseId, factor]) => ({ caseId, factor })),
    })),
  };
  const sourceHash = fnv1a(stableSerialize(project));
  const reference = `solver2d:${project.id}:${sourceHash}`;

  return {
    kind: 'planar-2d-to-space3d-handoff',
    version: 1,
    handoffId: `handoff:${reference}`,
    source: {
      system: 'solver2d',
      projectId: project.id,
      schemaVersion: project.schemaVersion,
      hash: { algorithm: 'fnv1a-32', value: reference.split(':').at(-1) ?? '00000000' },
      reference,
    },
    candidateModel,
    mapping: mappings,
    provenance: {
      adapter: 'fusionstructure/integrations/planar2d-to-space3d',
      sourceReference: reference,
      candidateSchemaVersion: candidateModel.schemaVersion,
    },
    lossReport: { status: notes.length === 0 ? 'lossless' : 'review-required', entries: notes },
  };
};
