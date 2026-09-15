import type {
  GeneratedLoadSource,
  MemberModel,
  MultiPointConstraint,
  NodeLink,
  PrescribedDisplacement,
  ProjectModel,
  SupportDefinition,
} from '../types';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember,
  type Space3DMemberRelease,
  type Space3DNodeLink,
  type Space3DProjectV2,
  type Space3DRestraints,
} from '../modules/space3d/space3d/public';
import type { Planar2DToSpace3DHandoffV1, Planar2DToSpace3DMapping } from '../modules/space3d/integrations/planar2dToSpace3d';

const finitePositive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

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

const releaseTo3D = (release: MemberModel['releases']): Space3DMemberRelease | undefined => release ? {
  iUx: release.iAxial, iUy: release.iShear, iRz: release.iMoment,
  jUx: release.jAxial, jUy: release.jShear, jRz: release.jMoment,
} : undefined;

const releaseTo2D = (release: Space3DMemberRelease | undefined): MemberModel['releases'] => {
  if (!release) return undefined;
  const result = {
    iAxial: release.iUx, iShear: release.iUy, iMoment: release.iRz,
    jAxial: release.jUx, jShear: release.jUy, jMoment: release.jRz,
  };
  return Object.values(result).some((value) => value !== undefined) ? result : undefined;
};

const directionFromAngle = (angleDeg = 0): readonly [number, number, number] => {
  const radians = angleDeg * Math.PI / 180;
  return [Math.cos(radians), Math.sin(radians), 0];
};

const mapping = (kind: Planar2DToSpace3DMapping['source']['entityKind'], id: string): Planar2DToSpace3DMapping => ({
  id: `${kind}:${id}`,
  source: { entityKind: kind, entityId: id },
  target: { entityKind: kind, entityId: id },
  disposition: 'preserved',
});

export const buildPlanar2DToSpace3DHandoff = (project: ProjectModel): Planar2DToSpace3DHandoffV1 => {
  const nodes = project.nodes.map((node) => ({
    id: node.id, x: node.x, y: node.y, z: 0,
    restraints: planarRestraints(node.support),
    planarSupport: structuredClone(node.support),
    ...(node.internalHinge === undefined ? {} : { internalHinge: node.internalHinge }),
  }));
  const members: Space3DFrameMember[] = project.members.map((member) => ({
    id: member.id, i: member.i, j: member.j,
    E: member.E, G: finitePositive(member.G) ? member.G : member.E / 2.6,
    A: member.A, Iy: member.I, Iz: member.I, J: member.type === 'truss' ? 0 : Math.max(Math.abs(member.I) * 0.1, Number.EPSILON),
    orientation: orientationFor(project, member),
    type: member.type,
    materialId: member.materialId, materialOrigin: member.materialOrigin,
    sectionId: member.sectionId, sectionOrigin: member.sectionOrigin,
    beamTheory: member.beamTheory, shearArea: member.shearArea, density: member.density,
    releases: releaseTo3D(member.releases), axialBehavior: member.axialBehavior,
    rotationalSpringI: member.rotationalSpringI, rotationalSpringJ: member.rotationalSpringJ,
    rigidOffsetI: member.rigidOffsetI, rigidOffsetJ: member.rigidOffsetJ,
    label: member.label,
    planarG: member.G ?? null,
  }));
  const nodeLinks: Space3DNodeLink[] = (project.nodeLinks ?? []).map((link) => ({
    ...structuredClone(link), direction: directionFromAngle(link.angleDeg),
  }));
  const candidateModel: Space3DProjectV2 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: `space3d:${project.id}`,
    name: project.name,
    units: 'kN-m',
    nodes,
    members,
    nodalLoads: project.nodalLoads.map((load) => ({ ...structuredClone(load), fz: 0, mx: 0, my: 0 })),
    loadCases: project.loadCases.map((item) => structuredClone(item)),
    loadCombinations: project.combinations.map(({ factors, ...item }) => ({
      ...structuredClone(item), terms: Object.entries(factors).map(([caseId, factor]) => ({ caseId, factor })),
    })),
    prescribedDisplacements: structuredClone(project.prescribedDisplacements ?? []),
    memberLoads: structuredClone(project.memberLoads),
    memberInitialEffects: structuredClone(project.memberInitialEffects ?? []),
    nodeLinks,
    multiPointConstraints: structuredClone(project.multiPointConstraints ?? []),
    nodalMasses: structuredClone(project.nodalMasses ?? []),
    generatedLoadSources: structuredClone(project.generatedLoadSources ?? []),
    movingLoadCases: structuredClone(project.movingLoadCases ?? []),
  };
  const groups: Array<[Planar2DToSpace3DMapping['source']['entityKind'], readonly { id: string }[]]> = [
    ['node', project.nodes], ['member', project.members], ['load', project.nodalLoads],
    ['member-load', project.memberLoads], ['prescribed-displacement', project.prescribedDisplacements ?? []],
    ['initial-effect', project.memberInitialEffects ?? []], ['node-link', project.nodeLinks ?? []],
    ['multi-point-constraint', project.multiPointConstraints ?? []], ['nodal-mass', project.nodalMasses ?? []],
    ['generated-load-source', project.generatedLoadSources ?? []], ['moving-load-case', project.movingLoadCases ?? []],
    ['case', project.loadCases], ['combination', project.combinations],
  ];
  const mappings = groups.flatMap(([kind, entities]) => entities.map((entity) => mapping(kind, entity.id)));
  const sourceHash = fnv1a(stableSerialize(project));
  const reference = `solver2d:${project.id}:${sourceHash}`;
  return {
    kind: 'planar-2d-to-space3d-handoff', version: 1, handoffId: `handoff:${reference}`,
    source: {
      system: 'solver2d', projectId: project.id, schemaVersion: project.schemaVersion,
      hash: { algorithm: 'fnv1a-32', value: sourceHash }, reference,
    },
    candidateModel,
    mapping: mappings,
    provenance: {
      adapter: 'fusionstructure/integrations/planar2d-to-space3d', sourceReference: reference,
      candidateSchemaVersion: candidateModel.schemaVersion,
    },
    lossReport: { status: 'lossless', entries: [] },
  };
};

/** Projects only planar-representable data; out-of-plane values never alias 2D fields. */
export const roundTripPlanarSpace3DTo2D = (spatial: Space3DProjectV2, template: ProjectModel): ProjectModel => {
  const sourceNodes = new Map(template.nodes.map((node) => [node.id, node]));
  const spatialPlanarNodeIds = new Set(spatial.nodes.filter((node) => Math.abs(node.z) <= 1e-12).map((node) => node.id));
  const nodes = spatial.nodes.flatMap((node) => {
    if (Math.abs(node.z) > 1e-12) {
      const source = sourceNodes.get(node.id);
      return source ? [structuredClone(source)] : [];
    }
    return [{
      id: node.id, x: node.x, y: node.y,
      support: node.planarSupport ? structuredClone(node.planarSupport) : {
        type: 'custom' as const, restrainX: node.restraints.ux, restrainY: node.restraints.uy, restrainR: node.restraints.rz,
      },
      ...(node.internalHinge === undefined ? {} : { internalHinge: node.internalHinge }),
    }];
  });
  const sourceMembers = new Map(template.members.map((member) => [member.id, member]));
  const members = spatial.members.flatMap((member): MemberModel[] => {
    if (!spatialPlanarNodeIds.has(member.i) || !spatialPlanarNodeIds.has(member.j)) {
      const source = sourceMembers.get(member.id);
      return source ? [structuredClone(source)] : [];
    }
    const releases = releaseTo2D(member.releases);
    return [{
      id: member.id, i: member.i, j: member.j, type: member.type ?? 'frame', E: member.E, A: member.A, I: member.Iz,
      ...(member.planarG === null ? {} : { G: member.planarG ?? member.G }),
      ...(member.materialId === undefined ? {} : { materialId: member.materialId }),
      ...(member.materialOrigin === undefined ? {} : { materialOrigin: member.materialOrigin }),
      ...(member.sectionId === undefined ? {} : { sectionId: member.sectionId }),
      ...(member.sectionOrigin === undefined ? {} : { sectionOrigin: member.sectionOrigin }),
      ...(member.beamTheory === undefined ? {} : { beamTheory: member.beamTheory }),
      ...(member.shearArea === undefined ? {} : { shearArea: member.shearArea }),
      ...(member.density === undefined ? {} : { density: member.density }),
      ...(releases === undefined ? {} : { releases }),
      ...(member.axialBehavior === undefined ? {} : { axialBehavior: member.axialBehavior }),
      ...(member.rotationalSpringI === undefined ? {} : { rotationalSpringI: member.rotationalSpringI }),
      ...(member.rotationalSpringJ === undefined ? {} : { rotationalSpringJ: member.rotationalSpringJ }),
      ...(member.rigidOffsetI === undefined ? {} : { rigidOffsetI: member.rigidOffsetI }),
      ...(member.rigidOffsetJ === undefined ? {} : { rigidOffsetJ: member.rigidOffsetJ }),
      ...(member.label === undefined ? {} : { label: member.label }),
    }];
  });
  const spatialPlanarMemberIds = new Set(spatial.members.filter((member) => spatialPlanarNodeIds.has(member.i) && spatialPlanarNodeIds.has(member.j)).map((member) => member.id));
  const sourceNodalLoads = new Map(template.nodalLoads.map((item) => [item.id, item]));
  const sourcePrescribed = new Map((template.prescribedDisplacements ?? []).map((item) => [item.id, item]));
  const sourceMemberLoads = new Map(template.memberLoads.map((item) => [item.id, item]));
  const sourceEffects = new Map((template.memberInitialEffects ?? []).map((item) => [item.id, item]));
  const sourceLinks = new Map((template.nodeLinks ?? []).map((item) => [item.id, item]));
  const sourceMpcs = new Map((template.multiPointConstraints ?? []).map((item) => [item.id, item]));
  const sourceMasses = new Map((template.nodalMasses ?? []).map((item) => [item.id, item]));
  const sourceGenerated = new Map((template.generatedLoadSources ?? []).map((item) => [item.id, item]));
  const sourceMoving = new Map((template.movingLoadCases ?? []).map((item) => [item.id, item]));
  return {
    ...structuredClone(template),
    name: spatial.name,
    nodes,
    members,
    loadCases: spatial.loadCases.map((item) => ({
      id: item.id, name: item.name, category: item.category ?? 'other', active: item.active ?? true,
      ...(item.selfWeightFactor === undefined ? {} : { selfWeightFactor: item.selfWeightFactor }),
    })),
    combinations: spatial.loadCombinations.map(({ terms, ...item }) => ({
      ...structuredClone(item), factors: Object.fromEntries(terms.map((term) => [term.caseId, term.factor])),
    })),
    nodalLoads: spatial.nodalLoads.flatMap(({ fz: _fz, mx: _mx, my: _my, ...load }) => {
      if (spatialPlanarNodeIds.has(load.nodeId)) return [structuredClone(load)];
      const source = sourceNodalLoads.get(load.id);
      return source ? [structuredClone(source)] : [];
    }),
    prescribedDisplacements: spatial.prescribedDisplacements.flatMap((item): PrescribedDisplacement[] => {
      if (spatialPlanarNodeIds.has(item.nodeId) && (item.component === 'ux' || item.component === 'uy' || item.component === 'rz' || item.component === 'normal')) {
        const { normalDirection: _direction, ...planar } = item;
        return [structuredClone(planar) as PrescribedDisplacement];
      }
      const source = sourcePrescribed.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
    memberLoads: spatial.memberLoads.flatMap(({ qzStart: _qzs, qzEnd: _qze, pz: _pz, mx: _mx, my: _my, mz: _mz, ...item }) => {
      if (spatialPlanarMemberIds.has(item.memberId)) return [structuredClone(item)];
      const source = sourceMemberLoads.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
    memberInitialEffects: spatial.memberInitialEffects.flatMap(({ gradientY: _gy, gradientZ: _gz, curvatureY: _cy, curvatureZ: _cz, ...item }) => {
      if (spatialPlanarMemberIds.has(item.memberId)) return [structuredClone(item)];
      const source = sourceEffects.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
    nodeLinks: spatial.nodeLinks.flatMap((item): NodeLink[] => {
      if (spatialPlanarNodeIds.has(item.nodeI) && (!item.nodeJ || spatialPlanarNodeIds.has(item.nodeJ)) && Math.abs(item.direction[2]) <= 1e-12) {
        const { direction: _direction, ...planar } = item;
        return [structuredClone(planar)];
      }
      const source = sourceLinks.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
    multiPointConstraints: spatial.multiPointConstraints
      .map((item) => ({ ...structuredClone(item), terms: item.terms.filter((term) => spatialPlanarNodeIds.has(term.nodeId) && (term.component === 'ux' || term.component === 'uy' || term.component === 'rz')) }))
      .flatMap((item): MultiPointConstraint[] => {
        if (item.terms.length > 0) return [item as MultiPointConstraint];
        const source = sourceMpcs.get(item.id);
        return source ? [structuredClone(source)] : [];
      }),
    nodalMasses: spatial.nodalMasses.flatMap(({ massX: _mx, massY: _my, massZ: _mz, inertiaX: _ix, inertiaY: _iy, inertiaZ: _iz, ...item }) => {
      if (spatialPlanarNodeIds.has(item.nodeId)) return [structuredClone(item)];
      const source = sourceMasses.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
    generatedLoadSources: spatial.generatedLoadSources.flatMap(({ qz: _qz, ...item }): GeneratedLoadSource[] => {
      if (item.direction !== 'global-z' && item.memberIds.every((id) => spatialPlanarMemberIds.has(id))) return [structuredClone(item) as GeneratedLoadSource];
      const source = sourceGenerated.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
    movingLoadCases: spatial.movingLoadCases.flatMap((item) => {
      if (item.memberIds.every((id) => spatialPlanarMemberIds.has(id))) return [{
        ...structuredClone(item), memberIds: [...item.memberIds], axles: item.axles.map((axle) => ({ ...axle })),
      }];
      const source = sourceMoving.get(item.id);
      return source ? [structuredClone(source)] : [];
    }),
  };
};
