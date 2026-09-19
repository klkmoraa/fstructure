/**
 * Validación fail-closed del modelo espacial.
 *
 * El validador nunca repara ni muta el proyecto: acumula todos los problemas y
 * devuelve una lista ordenada de forma determinista (`entityKind`, `entityId`,
 * `code`, `field`) para que la interfaz, el worker y los tests observen
 * siempre la misma secuencia.
 *
 * Los códigos no llevan texto: la traducción vive en el catálogo i18n y el
 * dominio se mantiene independiente del idioma.
 */
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_LIMITS,
  SPACE3D_SCHEMA_VERSION,
  Space3DGeometryError,
  type Space3DEntityKind,
  type Space3DProjectV1,
  type Space3DValidationCode,
  type Space3DValidationIssue,
  type Space3DVector,
} from './types';
import { buildMemberOrientation, memberLength } from '../engine/orientation';
import { isUnitSystemId } from '../../../../foundation/units';

const PROJECT_FIELDS = [
  'analysisSpace', 'schemaVersion', 'id', 'name', 'units', 'nodes', 'members', 'nodalLoads', 'loadCases', 'loadCombinations',
  'prescribedDisplacements', 'memberLoads', 'memberInitialEffects', 'nodeLinks', 'multiPointConstraints', 'nodalMasses',
  'generatedLoadSources', 'movingLoadCases',
];
const NODE_FIELDS = ['id', 'x', 'y', 'z', 'restraints', 'planarSupport', 'internalHinge'];
const RESTRAINT_FIELDS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'];
const MEMBER_FIELDS = [
  'id', 'i', 'j', 'E', 'G', 'A', 'Iy', 'Iz', 'J', 'orientation', 'type', 'materialId', 'materialOrigin', 'sectionId',
  'sectionOrigin', 'beamTheory', 'shearArea', 'density', 'releases', 'axialBehavior', 'rotationalSpringI', 'rotationalSpringJ',
  'rigidOffsetI', 'rigidOffsetJ', 'label', 'planarG',
];
const ORIENTATION_FIELDS = ['localYReferenceGlobal', 'rollRadians'];
const LOAD_FIELDS = ['id', 'caseId', 'nodeId', 'fx', 'fy', 'fz', 'mx', 'my', 'mz'];
const LOAD_COMPONENT_FIELDS = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'];
const CASE_FIELDS = ['id', 'name', 'category', 'active', 'selfWeightFactor'];
const COMBINATION_FIELDS = ['id', 'name', 'terms', 'source', 'sourceUrl', 'jurisdiction', 'edition', 'stateLimit', 'reviewedAt'];
const TERM_FIELDS = ['caseId', 'factor'];
const PRESCRIBED_FIELDS = ['id', 'nodeId', 'caseId', 'component', 'value', 'normalDirection'];
const MEMBER_LOAD_FIELDS = ['id', 'memberId', 'caseId', 'type', 'coordinateSystem', 'lengthBasis', 'start', 'end', 'qxStart', 'qxEnd', 'qyStart', 'qyEnd', 'qzStart', 'qzEnd', 'px', 'py', 'pz', 'mx', 'my', 'mz', 'moment', 'position'];
const INITIAL_EFFECT_FIELDS = ['id', 'memberId', 'caseId', 'type', 'alpha', 'deltaT', 'gradient', 'gradientY', 'gradientZ', 'axialStrain', 'curvature', 'curvatureY', 'curvatureZ'];
const NODE_LINK_FIELDS = ['id', 'nodeI', 'nodeJ', 'behavior', 'direction', 'angleDeg', 'stiffness', 'clearance', 'slipForce', 'label'];
const MPC_FIELDS = ['id', 'terms', 'value', 'label'];
const MPC_TERM_FIELDS = ['nodeId', 'component', 'coefficient'];
const MASS_FIELDS = ['id', 'nodeId', 'mass', 'rotationalInertia', 'massX', 'massY', 'massZ', 'inertiaX', 'inertiaY', 'inertiaZ', 'label'];
const GENERATED_FIELDS = ['id', 'kind', 'caseId', 'memberIds', 'pressure', 'tributaryWidth', 'direction', 'referenceY', 'unitWeight', 'pressureAtReference', 'sign', 'stiffness', 'qx', 'qy', 'qz', 'coordinateSystem', 'lengthBasis', 'pattern', 'force', 'eccentricity', 'label'];
const MOVING_FIELDS = ['id', 'name', 'memberIds', 'targetMemberId', 'targetPosition', 'quantity', 'startNodeId', 'impactFactor', 'axles'];
const AXLE_FIELDS = ['id', 'P', 'offset'];

const isPositiveFinite = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isFiniteNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeFinite = (value: unknown): boolean => isFiniteNumber(value) && (value as number) >= 0;
const isUnitInterval = (value: unknown): boolean => isFiniteNumber(value) && (value as number) >= 0 && (value as number) <= 1;
const isCoordinate = (value: unknown): boolean =>
  isFiniteNumber(value) && Math.abs(value as number) <= SPACE3D_LIMITS.maxCoordinateMagnitude;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const sortIssues = (issues: Space3DValidationIssue[]): Space3DValidationIssue[] =>
  [...issues].sort((a, b) =>
    compare(a.entityKind, b.entityKind)
    || compare(a.entityId, b.entityId)
    || compare(a.code, b.code)
    || compare(a.field, b.field));

interface Collector {
  readonly push: (code: Space3DValidationCode, entityKind: Space3DEntityKind, entityId: string, field: string) => void;
}

const unknownFields = (
  collect: Collector,
  source: unknown,
  allowed: readonly string[],
  entityKind: Space3DEntityKind,
  entityId: string,
) => {
  if (typeof source !== 'object' || source === null) return;
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) collect.push('unknown-field', entityKind, entityId, key);
  }
};

const checkIdentity = (
  collect: Collector,
  id: unknown,
  seen: Set<string>,
  entityKind: Space3DEntityKind,
) => {
  if (typeof id !== 'string' || id.trim() === '') {
    collect.push('empty-id', entityKind, typeof id === 'string' ? id : '', 'id');
    return;
  }
  if (seen.has(id)) collect.push('duplicate-id', entityKind, id, 'id');
  seen.add(id);
};

const isVector3 = (value: unknown): value is Space3DVector =>
  Array.isArray(value) && value.length === 3 && value.every((component) => isFiniteNumber(component));

const oneOf = (value: unknown, values: readonly unknown[]): boolean => values.includes(value);

const requireArray = (collect: Collector, value: unknown, field: string): readonly unknown[] => {
  if (!Array.isArray(value)) { collect.push('invalid-property', 'project', '', field); return []; }
  return value;
};

const entityObject = (collect: Collector, value: unknown, kind: Space3DEntityKind, id = ''): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  collect.push('invalid-property', kind, id, '$entity');
  return {};
};

const optionalFiniteFields = (collect: Collector, entity: Record<string, unknown>, fields: readonly string[], kind: Space3DEntityKind, id: string) => {
  for (const field of fields) if (entity[field] !== undefined && !isFiniteNumber(entity[field])) collect.push('invalid-property', kind, id, field);
};

export const validateSpace3DProject = (project: Space3DProjectV1): readonly Space3DValidationIssue[] => {
  const issues: Space3DValidationIssue[] = [];
  const collect: Collector = {
    push: (code, entityKind, entityId, field) => { issues.push({ code, entityKind, entityId, field }); },
  };

  if (typeof project !== 'object' || project === null) {
    collect.push('invalid-property', 'project', '', 'project');
    return Object.freeze(sortIssues(issues));
  }

  unknownFields(collect, project, PROJECT_FIELDS, 'project', '');
  if (project.analysisSpace !== SPACE3D_ANALYSIS_SPACE) collect.push('invalid-property', 'project', '', 'analysisSpace');
  if (project.schemaVersion !== SPACE3D_SCHEMA_VERSION) collect.push('invalid-property', 'project', '', 'schemaVersion');
  if (!isUnitSystemId(project.units)) collect.push('invalid-property', 'project', '', 'units');
  if (typeof project.id !== 'string' || project.id === '') collect.push('empty-id', 'project', '', 'id');
  if (typeof project.name !== 'string') collect.push('invalid-property', 'project', '', 'name');

  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const members = Array.isArray(project.members) ? project.members : [];
  const nodalLoads = Array.isArray(project.nodalLoads) ? project.nodalLoads : [];
  const loadCases = Array.isArray(project.loadCases) ? project.loadCases : [];
  const loadCombinations = Array.isArray(project.loadCombinations) ? project.loadCombinations : [];
  const prescribedDisplacements = requireArray(collect, project.prescribedDisplacements, 'prescribedDisplacements');
  const memberLoads = requireArray(collect, project.memberLoads, 'memberLoads');
  const memberInitialEffects = requireArray(collect, project.memberInitialEffects, 'memberInitialEffects');
  const nodeLinks = requireArray(collect, project.nodeLinks, 'nodeLinks');
  const multiPointConstraints = requireArray(collect, project.multiPointConstraints, 'multiPointConstraints');
  const nodalMasses = requireArray(collect, project.nodalMasses, 'nodalMasses');
  const generatedLoadSources = requireArray(collect, project.generatedLoadSources, 'generatedLoadSources');
  const movingLoadCases = requireArray(collect, project.movingLoadCases, 'movingLoadCases');
  if (!Array.isArray(project.nodes)) collect.push('invalid-property', 'project', '', 'nodes');
  if (!Array.isArray(project.members)) collect.push('invalid-property', 'project', '', 'members');
  if (!Array.isArray(project.nodalLoads)) collect.push('invalid-property', 'project', '', 'nodalLoads');
  if (!Array.isArray(project.loadCases)) collect.push('invalid-property', 'project', '', 'loadCases');
  if (!Array.isArray(project.loadCombinations)) collect.push('invalid-property', 'project', '', 'loadCombinations');

  const nodeIds = new Set<string>();
  const nodeById = new Map<string, { x: number; y: number; z: number }>();
  for (const node of nodes) {
    unknownFields(collect, node, NODE_FIELDS, 'node', node?.id ?? '');
    checkIdentity(collect, node?.id, nodeIds, 'node');
    const id = typeof node?.id === 'string' ? node.id : '';
    for (const axis of ['x', 'y', 'z'] as const) {
      if (!isCoordinate(node?.[axis])) collect.push('invalid-coordinate', 'node', id, axis);
    }
    const restraints = node?.restraints;
    if (typeof restraints !== 'object' || restraints === null) {
      collect.push('invalid-property', 'node', id, 'restraints');
    } else {
      unknownFields(collect, restraints, RESTRAINT_FIELDS, 'node', id);
      for (const dof of RESTRAINT_FIELDS) {
        if (typeof (restraints as Record<string, unknown>)[dof] !== 'boolean') {
          collect.push('invalid-property', 'node', id, `restraints.${dof}`);
        }
      }
    }
    if (id !== '' && isCoordinate(node?.x) && isCoordinate(node?.y) && isCoordinate(node?.z) && !nodeById.has(id)) {
      nodeById.set(id, { x: node.x, y: node.y, z: node.z });
    }
  }

  const memberIds = new Set<string>();
  for (const member of members) {
    unknownFields(collect, member, MEMBER_FIELDS, 'member', member?.id ?? '');
    checkIdentity(collect, member?.id, memberIds, 'member');
    const id = typeof member?.id === 'string' ? member.id : '';

    const memberType = member?.type ?? 'frame';
    if (!oneOf(memberType, ['frame', 'truss', 'rigid'])) collect.push('invalid-property', 'member', id, 'type');
    // Frame properties drive all six-DOF stiffness terms. Trusses deliberately
    // carry zero bending/torsion properties; rigid links do not use them.
    if (memberType === 'frame') {
      for (const field of ['A', 'E', 'G', 'Iy', 'Iz', 'J'] as const) if (!isPositiveFinite(member?.[field])) collect.push('invalid-property', 'member', id, field);
    } else if (memberType === 'truss') {
      for (const field of ['A', 'E'] as const) if (!isPositiveFinite(member?.[field])) collect.push('invalid-property', 'member', id, field);
      for (const field of ['G', 'Iy', 'Iz', 'J'] as const) if (!isNonNegativeFinite(member?.[field])) collect.push('invalid-property', 'member', id, field);
    } else if (memberType === 'rigid') {
      for (const field of ['A', 'E'] as const) if (!isPositiveFinite(member?.[field])) collect.push('invalid-property', 'member', id, field);
      for (const field of ['G', 'Iy', 'Iz', 'J'] as const) if (!isNonNegativeFinite(member?.[field])) collect.push('invalid-property', 'member', id, field);
    }

    const orientation = member?.orientation;
    let orientationUsable = false;
    if (typeof orientation !== 'object' || orientation === null) {
      collect.push('invalid-property', 'member', id, 'orientation');
    } else {
      unknownFields(collect, orientation, ORIENTATION_FIELDS, 'member', id);
      const referenceOk = isVector3(orientation.localYReferenceGlobal);
      const rollOk = isFiniteNumber(orientation.rollRadians);
      if (!referenceOk) collect.push('invalid-property', 'member', id, 'orientation.localYReferenceGlobal');
      if (!rollOk) collect.push('invalid-property', 'member', id, 'orientation.rollRadians');
      orientationUsable = referenceOk && rollOk;
    }

    const start = typeof member?.i === 'string' ? nodeById.get(member.i) : undefined;
    const end = typeof member?.j === 'string' ? nodeById.get(member.j) : undefined;
    if (typeof member?.i !== 'string' || !nodeIds.has(member.i)) collect.push('missing-reference', 'member', id, 'i');
    if (typeof member?.j !== 'string' || !nodeIds.has(member.j)) collect.push('missing-reference', 'member', id, 'j');

    if (typeof member?.i === 'string' && member.i === member.j) {
      collect.push('self-referential-member', 'member', id, 'j');
      continue;
    }
    if (!start || !end) continue;

    const from: Space3DVector = [start.x, start.y, start.z];
    const to: Space3DVector = [end.x, end.y, end.z];
    if (memberLength(from, to) < SPACE3D_LIMITS.minMemberLength) {
      collect.push('degenerate-length', 'member', id, 'j');
      continue;
    }
    if (!orientationUsable) continue;
    try {
      buildMemberOrientation(from, to, member.orientation);
    } catch (error) {
      if (!(error instanceof Space3DGeometryError)) throw error;
      collect.push('degenerate-orientation', 'member', id, 'orientation');
    }
  }

  const caseIds = new Set<string>();
  for (const loadCase of loadCases) {
    unknownFields(collect, loadCase, CASE_FIELDS, 'case', loadCase?.id ?? '');
    checkIdentity(collect, loadCase?.id, caseIds, 'case');
    if (typeof loadCase?.name !== 'string') collect.push('invalid-property', 'case', loadCase?.id ?? '', 'name');
  }

  const loadIds = new Set<string>();
  for (const load of nodalLoads) {
    unknownFields(collect, load, LOAD_FIELDS, 'load', load?.id ?? '');
    checkIdentity(collect, load?.id, loadIds, 'load');
    const id = typeof load?.id === 'string' ? load.id : '';
    if (typeof load?.nodeId !== 'string' || !nodeIds.has(load.nodeId)) collect.push('missing-reference', 'load', id, 'nodeId');
    if (typeof load?.caseId !== 'string' || !caseIds.has(load.caseId)) collect.push('missing-case', 'load', id, 'caseId');
    for (const component of LOAD_COMPONENT_FIELDS) {
      if (!isFiniteNumber(load?.[component as keyof typeof load])) collect.push('invalid-property', 'load', id, component);
    }
  }

  const combinationIds = new Set<string>();
  for (const combination of loadCombinations) {
    unknownFields(collect, combination, COMBINATION_FIELDS, 'combination', combination?.id ?? '');
    checkIdentity(collect, combination?.id, combinationIds, 'combination');
    const id = typeof combination?.id === 'string' ? combination.id : '';
    if (typeof combination?.name !== 'string') collect.push('invalid-property', 'combination', id, 'name');
    const terms = Array.isArray(combination?.terms) ? combination.terms : [];
    if (!Array.isArray(combination?.terms)) collect.push('invalid-property', 'combination', id, 'terms');
    for (const term of terms) {
      unknownFields(collect, term, TERM_FIELDS, 'combination', id);
      if (typeof term?.caseId !== 'string' || !caseIds.has(term.caseId)) collect.push('missing-case', 'combination', id, 'terms.caseId');
      if (!isFiniteNumber(term?.factor)) collect.push('invalid-property', 'combination', id, 'terms.factor');
    }
  }

  const validateEntityRef = (entity: Record<string, unknown>, id: string, field: string, ids: ReadonlySet<string>, kind: Space3DEntityKind) => {
    if (typeof entity[field] !== 'string' || !ids.has(entity[field] as string)) collect.push(field === 'caseId' ? 'missing-case' : 'missing-reference', kind, id, field);
  };
  const semanticIds = new Map<Space3DEntityKind, Set<string>>();
  const idsFor = (kind: Space3DEntityKind) => { const found = semanticIds.get(kind) ?? new Set<string>(); semanticIds.set(kind, found); return found; };

  for (const raw of prescribedDisplacements) {
    const entity = entityObject(collect, raw, 'prescribed-displacement'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, PRESCRIBED_FIELDS, 'prescribed-displacement', id); checkIdentity(collect, entity?.id, idsFor('prescribed-displacement'), 'prescribed-displacement');
    validateEntityRef(entity, id, 'nodeId', nodeIds, 'prescribed-displacement'); validateEntityRef(entity, id, 'caseId', caseIds, 'prescribed-displacement');
    if (!oneOf(entity.component, ['ux', 'uy', 'uz', 'rx', 'ry', 'rz', 'normal'])) collect.push('invalid-property', 'prescribed-displacement', id, 'component');
    if (!isFiniteNumber(entity.value)) collect.push('invalid-property', 'prescribed-displacement', id, 'value');
    if (entity.normalDirection !== undefined && !isVector3(entity.normalDirection)) collect.push('invalid-property', 'prescribed-displacement', id, 'normalDirection');
  }
  for (const raw of memberLoads) {
    const entity = entityObject(collect, raw, 'member-load'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, MEMBER_LOAD_FIELDS, 'member-load', id); checkIdentity(collect, entity?.id, idsFor('member-load'), 'member-load');
    validateEntityRef(entity, id, 'memberId', memberIds, 'member-load'); validateEntityRef(entity, id, 'caseId', caseIds, 'member-load');
    if (!oneOf(entity.type, ['distributed', 'point', 'moment'])) collect.push('invalid-property', 'member-load', id, 'type');
    if (!oneOf(entity.coordinateSystem, ['global', 'local'])) collect.push('invalid-property', 'member-load', id, 'coordinateSystem');
    if (!oneOf(entity.lengthBasis, ['real', 'horizontal', 'vertical'])) collect.push('invalid-property', 'member-load', id, 'lengthBasis');
    optionalFiniteFields(collect, entity, ['start', 'end', 'qxStart', 'qxEnd', 'qyStart', 'qyEnd', 'qzStart', 'qzEnd', 'px', 'py', 'pz', 'mx', 'my', 'mz', 'moment', 'position'], 'member-load', id);
    if (!isUnitInterval(entity.start) || !isUnitInterval(entity.end)) collect.push('invalid-property', 'member-load', id, 'start/end');
    if (entity.type === 'distributed' && isUnitInterval(entity.start) && isUnitInterval(entity.end) && (entity.start as number) > (entity.end as number)) {
      collect.push('invalid-property', 'member-load', id, 'start/end');
    }
    if (entity.position !== undefined && !isUnitInterval(entity.position)) collect.push('invalid-property', 'member-load', id, 'position');
    const permittedByType = entity.type === 'distributed' ? ['qxStart', 'qxEnd', 'qyStart', 'qyEnd', 'qzStart', 'qzEnd']
      : entity.type === 'point' ? ['px', 'py', 'pz', 'position'] : entity.type === 'moment' ? ['mx', 'my', 'mz', 'moment', 'position'] : [];
    for (const field of ['qxStart', 'qxEnd', 'qyStart', 'qyEnd', 'qzStart', 'qzEnd', 'px', 'py', 'pz', 'mx', 'my', 'mz', 'moment', 'position']) if (entity[field] !== undefined && !permittedByType.includes(field)) collect.push('invalid-property', 'member-load', id, field);
  }
  for (const raw of memberInitialEffects) {
    const entity = entityObject(collect, raw, 'initial-effect'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, INITIAL_EFFECT_FIELDS, 'initial-effect', id); checkIdentity(collect, entity?.id, idsFor('initial-effect'), 'initial-effect');
    validateEntityRef(entity, id, 'memberId', memberIds, 'initial-effect'); validateEntityRef(entity, id, 'caseId', caseIds, 'initial-effect');
    if (!oneOf(entity.type, ['temperature', 'initial-strain'])) collect.push('invalid-property', 'initial-effect', id, 'type');
    optionalFiniteFields(collect, entity, INITIAL_EFFECT_FIELDS.slice(4), 'initial-effect', id);
    const incompatible = entity.type === 'temperature' ? ['axialStrain', 'curvature', 'curvatureY', 'curvatureZ'] : ['alpha', 'deltaT', 'gradient', 'gradientY', 'gradientZ'];
    for (const field of incompatible) if (entity[field] !== undefined) collect.push('invalid-property', 'initial-effect', id, field);
  }
  for (const raw of nodeLinks) {
    const entity = entityObject(collect, raw, 'node-link'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, NODE_LINK_FIELDS, 'node-link', id); checkIdentity(collect, entity?.id, idsFor('node-link'), 'node-link');
    validateEntityRef(entity, id, 'nodeI', nodeIds, 'node-link'); if (entity.nodeJ !== undefined) validateEntityRef(entity, id, 'nodeJ', nodeIds, 'node-link');
    if (entity.nodeJ !== undefined && entity.nodeJ === entity.nodeI) collect.push('invalid-property', 'node-link', id, 'nodeJ');
    if (!oneOf(entity.behavior, ['linear', 'compression-only', 'tension-only', 'stop', 'friction'])) collect.push('invalid-property', 'node-link', id, 'behavior');
    if (!isVector3(entity.direction)) collect.push('invalid-property', 'node-link', id, 'direction');
    optionalFiniteFields(collect, entity, ['stiffness', 'angleDeg', 'clearance', 'slipForce'], 'node-link', id);
    if (!isPositiveFinite(entity.stiffness)) collect.push('invalid-property', 'node-link', id, 'stiffness');
    if (entity.clearance !== undefined && !isNonNegativeFinite(entity.clearance)) collect.push('invalid-property', 'node-link', id, 'clearance');
    if (entity.slipForce !== undefined && !isNonNegativeFinite(entity.slipForce)) collect.push('invalid-property', 'node-link', id, 'slipForce');
    if (entity.behavior === 'friction' && !isPositiveFinite(entity.slipForce)) collect.push('invalid-property', 'node-link', id, 'slipForce');
  }
  for (const raw of multiPointConstraints) {
    const entity = entityObject(collect, raw, 'multi-point-constraint'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, MPC_FIELDS, 'multi-point-constraint', id); checkIdentity(collect, entity?.id, idsFor('multi-point-constraint'), 'multi-point-constraint');
    const terms = Array.isArray(entity.terms) ? entity.terms : [];
    if (!Array.isArray(entity.terms)) collect.push('invalid-property', 'multi-point-constraint', id, 'terms');
    if (Array.isArray(entity.terms) && terms.length < 2) collect.push('invalid-property', 'multi-point-constraint', id, 'terms');
    if (Array.isArray(entity.terms) && terms.length > 0 && !terms.some((termRaw) => {
      const term = termRaw && typeof termRaw === 'object' && !Array.isArray(termRaw) ? termRaw as Record<string, unknown> : null;
      return term !== null && isFiniteNumber(term.coefficient) && Math.abs(term.coefficient as number) > 0;
    })) collect.push('invalid-property', 'multi-point-constraint', id, 'terms');
    for (const termRaw of terms) { const term = entityObject(collect, termRaw, 'multi-point-constraint', id); unknownFields(collect, term, MPC_TERM_FIELDS, 'multi-point-constraint', id); validateEntityRef(term, id, 'nodeId', nodeIds, 'multi-point-constraint'); if (!oneOf(term.component, ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'])) collect.push('invalid-property', 'multi-point-constraint', id, 'terms.component'); if (!isFiniteNumber(term.coefficient)) collect.push('invalid-property', 'multi-point-constraint', id, 'terms.coefficient'); }
    if (entity.value !== undefined && !isFiniteNumber(entity.value)) collect.push('invalid-property', 'multi-point-constraint', id, 'value');
  }
  for (const raw of nodalMasses) {
    const entity = entityObject(collect, raw, 'nodal-mass'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, MASS_FIELDS, 'nodal-mass', id); checkIdentity(collect, entity?.id, idsFor('nodal-mass'), 'nodal-mass'); validateEntityRef(entity, id, 'nodeId', nodeIds, 'nodal-mass');
    if (!isNonNegativeFinite(entity.mass)) collect.push('invalid-property', 'nodal-mass', id, 'mass');
    for (const field of ['rotationalInertia', 'massX', 'massY', 'massZ', 'inertiaX', 'inertiaY', 'inertiaZ'] as const) {
      if (entity[field] !== undefined && !isNonNegativeFinite(entity[field])) collect.push('invalid-property', 'nodal-mass', id, field);
    }
  }
  for (const raw of generatedLoadSources) {
    const entity = entityObject(collect, raw, 'generated-load-source'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, GENERATED_FIELDS, 'generated-load-source', id); checkIdentity(collect, entity?.id, idsFor('generated-load-source'), 'generated-load-source');
    if (!oneOf(entity.kind, ['tributary-surface', 'hydrostatic', 'soil-pressure', 'elastic-foundation', 'live-pattern', 'member-chain', 'prestress'])) collect.push('invalid-property', 'generated-load-source', id, 'kind');
    const memberRefs = Array.isArray(entity.memberIds) ? entity.memberIds : []; if (!Array.isArray(entity.memberIds)) collect.push('invalid-property', 'generated-load-source', id, 'memberIds');
    if (Array.isArray(entity.memberIds) && memberRefs.length === 0) collect.push('invalid-property', 'generated-load-source', id, 'memberIds');
    const generatedMemberIds = new Set<string>();
    for (const memberId of memberRefs) if (typeof memberId !== 'string' || !memberIds.has(memberId)) collect.push('missing-reference', 'generated-load-source', id, 'memberIds');
    for (const memberId of memberRefs) if (typeof memberId === 'string') {
      if (generatedMemberIds.has(memberId)) collect.push('invalid-property', 'generated-load-source', id, 'memberIds');
      generatedMemberIds.add(memberId);
    }
    if (entity.caseId !== undefined) validateEntityRef(entity, id, 'caseId', caseIds, 'generated-load-source');
    optionalFiniteFields(collect, entity, ['pressure', 'tributaryWidth', 'referenceY', 'unitWeight', 'pressureAtReference', 'stiffness', 'qx', 'qy', 'qz', 'force', 'eccentricity'], 'generated-load-source', id);
    if (entity.sign !== undefined && !oneOf(entity.sign, [1, -1])) collect.push('invalid-property', 'generated-load-source', id, 'sign');
    if (entity.direction !== undefined && !oneOf(entity.direction, ['global-x', 'global-y', 'global-z'])) collect.push('invalid-property', 'generated-load-source', id, 'direction');
    const requiredFields = entity.kind === 'tributary-surface' ? ['caseId', 'pressure', 'tributaryWidth', 'direction']
      : entity.kind === 'hydrostatic' || entity.kind === 'soil-pressure' ? ['caseId', 'referenceY', 'unitWeight', 'direction']
        : entity.kind === 'elastic-foundation' ? ['stiffness', 'direction']
          : entity.kind === 'live-pattern' || entity.kind === 'member-chain' ? ['caseId']
            : entity.kind === 'prestress' ? ['caseId', 'force'] : [];
    for (const field of requiredFields) if (entity[field] === undefined) collect.push('invalid-property', 'generated-load-source', id, field);
    if (entity.kind === 'tributary-surface') {
      if (!isNonNegativeFinite(entity.pressure)) collect.push('invalid-property', 'generated-load-source', id, 'pressure');
      if (!isNonNegativeFinite(entity.tributaryWidth)) collect.push('invalid-property', 'generated-load-source', id, 'tributaryWidth');
    }
    if (entity.kind === 'hydrostatic' || entity.kind === 'soil-pressure') {
      if (!isNonNegativeFinite(entity.unitWeight)) collect.push('invalid-property', 'generated-load-source', id, 'unitWeight');
      if (entity.pressureAtReference !== undefined && !isNonNegativeFinite(entity.pressureAtReference)) collect.push('invalid-property', 'generated-load-source', id, 'pressureAtReference');
    }
    if (entity.kind === 'elastic-foundation' && !isPositiveFinite(entity.stiffness)) collect.push('invalid-property', 'generated-load-source', id, 'stiffness');
    if ((entity.kind === 'live-pattern' || entity.kind === 'member-chain') && entity.qx === undefined && entity.qy === undefined && entity.qz === undefined) collect.push('invalid-property', 'generated-load-source', id, 'qx|qy|qz');
  }
  for (const raw of movingLoadCases) {
    const entity = entityObject(collect, raw, 'moving-load-case'); const id = typeof entity.id === 'string' ? entity.id : '';
    unknownFields(collect, entity, MOVING_FIELDS, 'moving-load-case', id); checkIdentity(collect, entity?.id, idsFor('moving-load-case'), 'moving-load-case');
    const memberRefs = Array.isArray(entity.memberIds) ? entity.memberIds : []; if (!Array.isArray(entity.memberIds)) collect.push('invalid-property', 'moving-load-case', id, 'memberIds');
    if (Array.isArray(entity.memberIds) && memberRefs.length === 0) collect.push('invalid-property', 'moving-load-case', id, 'memberIds');
    const movingMemberIds = new Set<string>();
    for (const memberId of memberRefs) if (typeof memberId !== 'string' || !memberIds.has(memberId)) collect.push('missing-reference', 'moving-load-case', id, 'memberIds');
    for (const memberId of memberRefs) if (typeof memberId === 'string') {
      if (movingMemberIds.has(memberId)) collect.push('invalid-property', 'moving-load-case', id, 'memberIds');
      movingMemberIds.add(memberId);
    }
    validateEntityRef(entity, id, 'targetMemberId', memberIds, 'moving-load-case');
    if (typeof entity.targetMemberId === 'string' && !movingMemberIds.has(entity.targetMemberId)) collect.push('invalid-property', 'moving-load-case', id, 'targetMemberId');
    if (entity.startNodeId !== undefined) validateEntityRef(entity, id, 'startNodeId', nodeIds, 'moving-load-case');
    if (!oneOf(entity.quantity, ['R', 'N', 'V', 'M'])) collect.push('invalid-property', 'moving-load-case', id, 'quantity');
    optionalFiniteFields(collect, entity, ['targetPosition', 'impactFactor'], 'moving-load-case', id); if (!isUnitInterval(entity.targetPosition)) collect.push('invalid-property', 'moving-load-case', id, 'targetPosition'); if (entity.impactFactor !== undefined && (!isPositiveFinite(entity.impactFactor))) collect.push('invalid-property', 'moving-load-case', id, 'impactFactor'); if (typeof entity.name !== 'string') collect.push('invalid-property', 'moving-load-case', id, 'name');
    const axles = Array.isArray(entity.axles) ? entity.axles : []; if (!Array.isArray(entity.axles)) collect.push('invalid-property', 'moving-load-case', id, 'axles');
    if (Array.isArray(entity.axles) && axles.length === 0) collect.push('invalid-property', 'moving-load-case', id, 'axles');
    const axleIds = new Set<string>(); for (const axleRaw of axles) { const axle = entityObject(collect, axleRaw, 'moving-load-case', id); unknownFields(collect, axle, AXLE_FIELDS, 'moving-load-case', id); if (!isNonNegativeFinite(axle.P)) collect.push('invalid-property', 'moving-load-case', id, 'axles.P'); if (!isFiniteNumber(axle.offset)) collect.push('invalid-property', 'moving-load-case', id, 'axles.offset'); if (axle.id !== undefined) checkIdentity(collect, axle.id, axleIds, 'moving-load-case'); }
  }

  return Object.freeze(sortIssues(issues));
};
