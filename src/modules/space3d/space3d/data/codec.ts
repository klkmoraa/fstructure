/**
 * Códec portable estricto de Space 3D.
 *
 * Sin Zod ni Ajv: cada objeto se recorre con una allowlist exacta antes de
 * convertirse al tipo de dominio. Un campo desconocido no se ignora — se
 * rechaza. Un archivo que «casi» encaja es la forma más rápida de corromper un
 * modelo estructural sin que nadie se entere.
 *
 * `JSON.stringify` convierte `NaN` e `Infinity` en `null`, así que aceptar
 * `null` donde se espera un número equivaldría a aceptar basura numérica: el
 * lector exige `typeof value === 'number' && Number.isFinite(value)`.
 */
import { validateSpace3DProject } from '../model/validation';
import { isUnitSystemId } from '../../../../foundation/units';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_LEGACY_SCHEMA_VERSION,
  SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember,
  type Space3DLoadCase,
  type Space3DLoadCombination,
  type Space3DGeneratedLoadSource,
  type Space3DMemberInitialEffect,
  type Space3DMemberLoad,
  type Space3DMovingLoadCase,
  type Space3DMultiPointConstraint,
  type Space3DNodalLoad,
  type Space3DNodalMass,
  type Space3DNode,
  type Space3DNodeLink,
  type Space3DPrescribedDisplacement,
  type Space3DProjectV1,
  type Space3DRestraints,
  type Space3DVector,
} from '../model/types';

export type Space3DCodecErrorCode =
  | 'malformed-json'
  | 'analysis-space'
  | 'schema-version'
  | 'unknown-field'
  | 'missing-field'
  | 'not-a-number'
  | 'not-a-string'
  | 'not-a-boolean'
  | 'not-an-array'
  | 'not-a-vector'
  | 'invalid-enum'
  | 'limit-exceeded'
  | 'invalid-model';

export class Space3DCodecError extends Error {
  readonly code: Space3DCodecErrorCode;

  constructor(code: Space3DCodecErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'Space3DCodecError';
    this.code = code;
  }
}

type Raw = Record<string, unknown>;

const fail = (code: Space3DCodecErrorCode, detail: string): never => { throw new Space3DCodecError(code, detail); };

const object = (value: unknown, path: string): Raw => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('malformed-json', path);
  return value as Raw;
};

/** Allowlist exacta: sobra un campo ⇒ se rechaza; falta uno requerido ⇒ se rechaza. */
const exactKeys = (source: Raw, required: readonly string[], path: string, optional: readonly string[] = []): void => {
  for (const key of Object.keys(source)) {
    if (!required.includes(key) && !optional.includes(key)) fail('unknown-field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(source, key)) fail('missing-field', `${path}.${key}`);
  }
};

const num = (source: Raw, key: string, path: string): number => {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('not-a-number', `${path}.${key}`);
  return value as number;
};

const text = (source: Raw, key: string, path: string): string => {
  const value = source[key];
  if (typeof value !== 'string') fail('not-a-string', `${path}.${key}`);
  return value as string;
};

const flag = (source: Raw, key: string, path: string): boolean => {
  const value = source[key];
  if (typeof value !== 'boolean') fail('not-a-boolean', `${path}.${key}`);
  return value as boolean;
};

const optionalNum = (source: Raw, key: string, path: string): number | undefined =>
  Object.hasOwn(source, key) ? num(source, key, path) : undefined;
const optionalText = (source: Raw, key: string, path: string): string | undefined =>
  Object.hasOwn(source, key) ? text(source, key, path) : undefined;
const optionalFlag = (source: Raw, key: string, path: string): boolean | undefined =>
  Object.hasOwn(source, key) ? flag(source, key, path) : undefined;
const enumValue = <T extends string | number>(value: unknown, allowed: readonly T[], path: string): T => {
  if (!allowed.includes(value as T)) fail('invalid-enum', `${path}: ${String(value)}`);
  return value as T;
};
const enumField = <T extends string | number>(source: Raw, key: string, allowed: readonly T[], path: string): T =>
  enumValue(source[key], allowed, `${path}.${key}`);
const optionalEnum = <T extends string | number>(source: Raw, key: string, allowed: readonly T[], path: string): T | undefined =>
  Object.hasOwn(source, key) ? enumField(source, key, allowed, path) : undefined;
const compact = <T extends Raw>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

const unitInterval = (value: number, path: string): number => {
  if (value < 0 || value > 1) fail('invalid-model', `${path} debe estar entre 0 y 1`);
  return value;
};

const list = (source: Raw, key: string, path: string, limit?: number): unknown[] => {
  const value = source[key];
  if (!Array.isArray(value)) fail('not-an-array', `${path}.${key}`);
  const array = value as unknown[];
  if (limit !== undefined && array.length > limit) fail('limit-exceeded', `${path}.${key} (${array.length} > ${limit})`);
  return array;
};

const vector = (value: unknown, path: string): Space3DVector => {
  if (!Array.isArray(value) || value.length !== 3) fail('not-a-vector', path);
  const array = value as unknown[];
  return array.map((component, index) => {
    if (typeof component !== 'number' || !Number.isFinite(component)) fail('not-a-number', `${path}[${index}]`);
    return component as number;
  }) as unknown as Space3DVector;
};

const readRestraints = (value: unknown, path: string): Space3DRestraints => {
  const source = object(value, path);
  exactKeys(source, ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'], path);
  return {
    ux: flag(source, 'ux', path), uy: flag(source, 'uy', path), uz: flag(source, 'uz', path),
    rx: flag(source, 'rx', path), ry: flag(source, 'ry', path), rz: flag(source, 'rz', path),
  };
};

const readNode = (value: unknown, index: number): Space3DNode => {
  const path = `nodes[${index}]`;
  const source = object(value, path);
  const optional = ['planarSupport', 'internalHinge'];
  exactKeys(source, ['id', 'x', 'y', 'z', 'restraints'], path, optional);
  return {
    id: text(source, 'id', path),
    x: num(source, 'x', path),
    y: num(source, 'y', path),
    z: num(source, 'z', path),
    restraints: readRestraints(source.restraints, `${path}.restraints`),
    ...(Object.hasOwn(source, 'planarSupport') ? { planarSupport: readPlanarSupport(source.planarSupport, `${path}.planarSupport`) } : {}),
    ...(Object.hasOwn(source, 'internalHinge') ? { internalHinge: flag(source, 'internalHinge', path) } : {}),
  };
};

const readSpring = (value: unknown, path: string) => {
  const source = object(value, path);
  const fields = ['kx', 'ky', 'kz', 'kr', 'krx', 'kry', 'krz', 'kNormal', 'direction', 'angleDeg'];
  exactKeys(source, [], path, fields);
  return compact({
    kx: optionalNum(source, 'kx', path), ky: optionalNum(source, 'ky', path), kz: optionalNum(source, 'kz', path),
    kr: optionalNum(source, 'kr', path), krx: optionalNum(source, 'krx', path), kry: optionalNum(source, 'kry', path),
    krz: optionalNum(source, 'krz', path), kNormal: optionalNum(source, 'kNormal', path),
    direction: Object.hasOwn(source, 'direction') ? vector(source.direction, `${path}.direction`) : undefined,
    angleDeg: optionalNum(source, 'angleDeg', path),
  });
};

const readPlanarSupport = (value: unknown, path: string) => {
  const source = object(value, path);
  const optional = ['angleDeg', 'restrainX', 'restrainY', 'restrainR', 'spring', 'prescribed'];
  exactKeys(source, ['type'], path, optional);
  let prescribed: { ux?: number; uy?: number; rz?: number; normal?: number } | undefined;
  if (Object.hasOwn(source, 'prescribed')) {
    const raw = object(source.prescribed, `${path}.prescribed`);
    exactKeys(raw, [], `${path}.prescribed`, ['ux', 'uy', 'rz', 'normal']);
    prescribed = compact({ ux: optionalNum(raw, 'ux', `${path}.prescribed`), uy: optionalNum(raw, 'uy', `${path}.prescribed`), rz: optionalNum(raw, 'rz', `${path}.prescribed`), normal: optionalNum(raw, 'normal', `${path}.prescribed`) });
  }
  return compact({
    type: enumField(source, 'type', ['none', 'pin', 'roller', 'fixed', 'custom'] as const, path),
    angleDeg: optionalNum(source, 'angleDeg', path), restrainX: optionalFlag(source, 'restrainX', path),
    restrainY: optionalFlag(source, 'restrainY', path), restrainR: optionalFlag(source, 'restrainR', path),
    spring: Object.hasOwn(source, 'spring') ? readSpring(source.spring, `${path}.spring`) : undefined, prescribed,
  });
};

const readMember = (value: unknown, index: number): Space3DFrameMember => {
  const path = `members[${index}]`;
  const source = object(value, path);
  const optional = [
    'type', 'materialId', 'materialOrigin', 'sectionId', 'sectionOrigin', 'beamTheory', 'shearArea', 'density',
    'releases', 'axialBehavior', 'rotationalSpringI', 'rotationalSpringJ', 'rigidOffsetI', 'rigidOffsetJ', 'label', 'planarG',
  ];
  exactKeys(source, ['id', 'i', 'j', 'E', 'G', 'A', 'Iy', 'Iz', 'J', 'orientation'], path, optional);
  const orientationPath = `${path}.orientation`;
  const orientation = object(source.orientation, orientationPath);
  exactKeys(orientation, ['localYReferenceGlobal', 'rollRadians'], orientationPath);
  return {
    id: text(source, 'id', path),
    i: text(source, 'i', path),
    j: text(source, 'j', path),
    E: num(source, 'E', path),
    G: num(source, 'G', path),
    A: num(source, 'A', path),
    Iy: num(source, 'Iy', path),
    Iz: num(source, 'Iz', path),
    J: num(source, 'J', path),
    orientation: {
      localYReferenceGlobal: vector(orientation.localYReferenceGlobal, `${orientationPath}.localYReferenceGlobal`),
      rollRadians: num(orientation, 'rollRadians', orientationPath),
    },
    ...compact({
      type: optionalEnum(source, 'type', ['frame', 'truss', 'rigid'] as const, path),
      materialId: optionalText(source, 'materialId', path),
      materialOrigin: optionalEnum(source, 'materialOrigin', ['catalog', 'custom', 'imported', 'legacy'] as const, path),
      sectionId: optionalText(source, 'sectionId', path),
      sectionOrigin: optionalEnum(source, 'sectionOrigin', ['catalog', 'custom', 'imported', 'legacy'] as const, path),
      beamTheory: optionalEnum(source, 'beamTheory', ['euler-bernoulli', 'timoshenko'] as const, path),
      shearArea: optionalNum(source, 'shearArea', path), density: optionalNum(source, 'density', path),
      releases: Object.hasOwn(source, 'releases') ? readRelease(source.releases, `${path}.releases`) : undefined,
      axialBehavior: optionalEnum(source, 'axialBehavior', ['both', 'tension-only', 'compression-only'] as const, path),
      rotationalSpringI: optionalNum(source, 'rotationalSpringI', path), rotationalSpringJ: optionalNum(source, 'rotationalSpringJ', path),
      rigidOffsetI: optionalNum(source, 'rigidOffsetI', path), rigidOffsetJ: optionalNum(source, 'rigidOffsetJ', path),
      label: optionalText(source, 'label', path),
      planarG: Object.hasOwn(source, 'planarG') ? (source.planarG === null ? null : num(source, 'planarG', path)) : undefined,
    }),
  };
};

const readRelease = (value: unknown, path: string) => {
  const source = object(value, path);
  const fields = ['iUx', 'iUy', 'iUz', 'iRx', 'iRy', 'iRz', 'jUx', 'jUy', 'jUz', 'jRx', 'jRy', 'jRz'];
  exactKeys(source, [], path, fields);
  return compact(Object.fromEntries(fields.map((field) => [field, optionalFlag(source, field, path)])));
};

const readLoad = (value: unknown, index: number): Space3DNodalLoad => {
  const path = `nodalLoads[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'caseId', 'nodeId', 'fx', 'fy', 'fz', 'mx', 'my', 'mz'], path);
  return {
    id: text(source, 'id', path),
    caseId: text(source, 'caseId', path),
    nodeId: text(source, 'nodeId', path),
    fx: num(source, 'fx', path), fy: num(source, 'fy', path), fz: num(source, 'fz', path),
    mx: num(source, 'mx', path), my: num(source, 'my', path), mz: num(source, 'mz', path),
  };
};

const readCase = (value: unknown, index: number): Space3DLoadCase => {
  const path = `loadCases[${index}]`;
  const source = object(value, path);
  const optional = ['category', 'active', 'selfWeightFactor'];
  exactKeys(source, ['id', 'name'], path, optional);
  return compact({ id: text(source, 'id', path), name: text(source, 'name', path),
    category: optionalEnum(source, 'category', ['permanent', 'variable', 'accidental', 'other'] as const, path),
    active: optionalFlag(source, 'active', path), selfWeightFactor: optionalNum(source, 'selfWeightFactor', path) });
};

const readCombination = (value: unknown, index: number): Space3DLoadCombination => {
  const path = `loadCombinations[${index}]`;
  const source = object(value, path);
  const optional = ['source', 'sourceUrl', 'jurisdiction', 'edition', 'stateLimit', 'reviewedAt'];
  exactKeys(source, ['id', 'name', 'terms'], path, optional);
  return {
    id: text(source, 'id', path),
    name: text(source, 'name', path),
    terms: list(source, 'terms', path).map((term, termIndex) => {
      const termPath = `${path}.terms[${termIndex}]`;
      const raw = object(term, termPath);
      exactKeys(raw, ['caseId', 'factor'], termPath);
      return { caseId: text(raw, 'caseId', termPath), factor: num(raw, 'factor', termPath) };
    }),
    ...compact({ source: optionalText(source, 'source', path), sourceUrl: optionalText(source, 'sourceUrl', path),
      jurisdiction: optionalText(source, 'jurisdiction', path), edition: optionalText(source, 'edition', path),
      stateLimit: optionalEnum(source, 'stateLimit', ['service', 'ultimate', 'other'] as const, path),
      reviewedAt: optionalText(source, 'reviewedAt', path) }),
  };
};

const readPrescribedDisplacement = (value: unknown, index: number): Space3DPrescribedDisplacement => {
  const path = `prescribedDisplacements[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'nodeId', 'caseId', 'component', 'value'], path, ['normalDirection']);
  return { id: text(source, 'id', path), nodeId: text(source, 'nodeId', path), caseId: text(source, 'caseId', path),
    component: enumField(source, 'component', ['ux', 'uy', 'uz', 'rx', 'ry', 'rz', 'normal'] as const, path), value: num(source, 'value', path),
    ...(Object.hasOwn(source, 'normalDirection') ? { normalDirection: vector(source.normalDirection, `${path}.normalDirection`) } : {}) };
};

const readMemberLoad = (value: unknown, index: number): Space3DMemberLoad => {
  const path = `memberLoads[${index}]`;
  const source = object(value, path);
  const type = enumField(source, 'type', ['distributed', 'point', 'moment'] as const, path);
  const optional = type === 'distributed' ? ['qxStart', 'qxEnd', 'qyStart', 'qyEnd', 'qzStart', 'qzEnd']
    : type === 'point' ? ['px', 'py', 'pz', 'position'] : ['mx', 'my', 'mz', 'moment', 'position'];
  exactKeys(source, ['id', 'memberId', 'caseId', 'type', 'coordinateSystem', 'lengthBasis', 'start', 'end'], path, optional);
  let start = unitInterval(num(source, 'start', path), `${path}.start`);
  let end = unitInterval(num(source, 'end', path), `${path}.end`);
  const optionalValues = Object.fromEntries(optional.map((field) => [field, optionalNum(source, field, path)])) as Raw;
  // Keep the same canonical interval semantics as the planar migration. The
  // endpoint intensities travel with their endpoint, including qz in V2.
  if (type === 'distributed' && start > end) {
    [start, end] = [end, start];
    for (const [from, to] of [['qxStart', 'qxEnd'], ['qyStart', 'qyEnd'], ['qzStart', 'qzEnd']]) {
      [optionalValues[from], optionalValues[to]] = [optionalValues[to], optionalValues[from]];
    }
  }
  if (Object.hasOwn(optionalValues, 'position')) unitInterval(optionalValues.position as number, `${path}.position`);
  return compact({ id: text(source, 'id', path), memberId: text(source, 'memberId', path), caseId: text(source, 'caseId', path),
    type,
    coordinateSystem: enumField(source, 'coordinateSystem', ['global', 'local'] as const, path),
    lengthBasis: enumField(source, 'lengthBasis', ['real', 'horizontal', 'vertical'] as const, path),
    start, end,
    ...optionalValues,
  }) as unknown as Space3DMemberLoad;
};

const readInitialEffect = (value: unknown, index: number): Space3DMemberInitialEffect => {
  const path = `memberInitialEffects[${index}]`;
  const source = object(value, path);
  const type = enumField(source, 'type', ['temperature', 'initial-strain'] as const, path);
  const optional = type === 'temperature' ? ['alpha', 'deltaT', 'gradient', 'gradientY', 'gradientZ'] : ['axialStrain', 'curvature', 'curvatureY', 'curvatureZ'];
  exactKeys(source, ['id', 'memberId', 'caseId', 'type'], path, optional);
  return compact({ id: text(source, 'id', path), memberId: text(source, 'memberId', path), caseId: text(source, 'caseId', path), type,
    ...Object.fromEntries(optional.map((field) => [field, optionalNum(source, field, path)])) }) as unknown as Space3DMemberInitialEffect;
};

const readNodeLink = (value: unknown, index: number): Space3DNodeLink => {
  const path = `nodeLinks[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'nodeI', 'behavior', 'direction', 'stiffness'], path, ['nodeJ', 'angleDeg', 'clearance', 'slipForce', 'label']);
  const nodeI = text(source, 'nodeI', path);
  const nodeJ = optionalText(source, 'nodeJ', path);
  if (nodeJ !== undefined && nodeJ === nodeI) fail('invalid-model', `${path}.nodeJ debe ser distinto de nodeI`);
  return compact({ id: text(source, 'id', path), nodeI: text(source, 'nodeI', path), nodeJ: optionalText(source, 'nodeJ', path),
    behavior: enumField(source, 'behavior', ['linear', 'compression-only', 'tension-only', 'stop', 'friction'] as const, path),
    direction: vector(source.direction, `${path}.direction`), stiffness: num(source, 'stiffness', path), angleDeg: optionalNum(source, 'angleDeg', path),
    clearance: optionalNum(source, 'clearance', path), slipForce: optionalNum(source, 'slipForce', path), label: optionalText(source, 'label', path) });
};

const readMpc = (value: unknown, index: number): Space3DMultiPointConstraint => {
  const path = `multiPointConstraints[${index}]`;
  const source = object(value, path);
  exactKeys(source, ['id', 'terms'], path, ['value', 'label']);
  const terms = list(source, 'terms', path).map((term, termIndex) => {
    const termPath = `${path}.terms[${termIndex}]`; const raw = object(term, termPath);
    exactKeys(raw, ['nodeId', 'component', 'coefficient'], termPath);
    return { nodeId: text(raw, 'nodeId', termPath), component: enumField(raw, 'component', ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const, termPath), coefficient: num(raw, 'coefficient', termPath) };
  });
  if (terms.length < 2) fail('invalid-model', `${path}.terms debe contener al menos dos términos`);
  if (!terms.some((term) => Math.abs(term.coefficient) > 0)) fail('invalid-model', `${path}.terms debe incluir un coeficiente no nulo`);
  return compact({ id: text(source, 'id', path), terms, value: optionalNum(source, 'value', path), label: optionalText(source, 'label', path) });
};

const readNodalMass = (value: unknown, index: number): Space3DNodalMass => {
  const path = `nodalMasses[${index}]`; const source = object(value, path);
  const optional = ['rotationalInertia', 'massX', 'massY', 'massZ', 'inertiaX', 'inertiaY', 'inertiaZ', 'label'];
  exactKeys(source, ['id', 'nodeId', 'mass'], path, optional);
  return compact({ id: text(source, 'id', path), nodeId: text(source, 'nodeId', path), mass: num(source, 'mass', path),
    ...Object.fromEntries(optional.map((field) => [field, field === 'label' ? optionalText(source, field, path) : optionalNum(source, field, path)])) }) as unknown as Space3DNodalMass;
};

const readGeneratedSource = (value: unknown, index: number): Space3DGeneratedLoadSource => {
  const path = `generatedLoadSources[${index}]`; const source = object(value, path);
  const kind = enumField(source, 'kind', ['tributary-surface', 'hydrostatic', 'soil-pressure', 'elastic-foundation', 'live-pattern', 'member-chain', 'prestress'] as const, path);
  const common = ['id', 'kind', 'memberIds'];
  const specification = kind === 'tributary-surface' ? { required: ['caseId', 'pressure', 'tributaryWidth', 'direction'], optional: ['label'] }
    : kind === 'hydrostatic' || kind === 'soil-pressure' ? { required: ['caseId', 'referenceY', 'unitWeight', 'direction'], optional: ['pressureAtReference', 'sign', 'label'] }
      : kind === 'elastic-foundation' ? { required: ['stiffness', 'direction'], optional: ['label'] }
        : kind === 'live-pattern' || kind === 'member-chain' ? { required: ['caseId'], optional: ['qx', 'qy', 'qz', 'coordinateSystem', 'lengthBasis', 'pattern', 'label'] }
          : { required: ['caseId', 'force'], optional: ['eccentricity', 'label'] };
  exactKeys(source, [...common, ...specification.required], path, specification.optional);
  const memberIds = list(source, 'memberIds', path).map((item, itemIndex) => typeof item === 'string' ? item : fail('not-a-string', `${path}.memberIds[${itemIndex}]`));
  if (memberIds.length === 0) fail('invalid-model', `${path}.memberIds debe incluir al menos un miembro`);
  if (new Set(memberIds).size !== memberIds.length) fail('invalid-model', `${path}.memberIds no puede repetir miembros`);
  if ((kind === 'live-pattern' || kind === 'member-chain') && !['qx', 'qy', 'qz'].some((field) => Object.hasOwn(source, field))) fail('missing-field', `${path}.qx|qy|qz`);
  return compact({ id: text(source, 'id', path), kind, memberIds, caseId: optionalText(source, 'caseId', path), pressure: optionalNum(source, 'pressure', path),
    tributaryWidth: optionalNum(source, 'tributaryWidth', path), direction: optionalEnum(source, 'direction', ['global-x', 'global-y', 'global-z'] as const, path),
    referenceY: optionalNum(source, 'referenceY', path), unitWeight: optionalNum(source, 'unitWeight', path), pressureAtReference: optionalNum(source, 'pressureAtReference', path),
    sign: optionalEnum(source, 'sign', [1, -1] as const, path), stiffness: optionalNum(source, 'stiffness', path), qx: optionalNum(source, 'qx', path), qy: optionalNum(source, 'qy', path), qz: optionalNum(source, 'qz', path),
    coordinateSystem: optionalEnum(source, 'coordinateSystem', ['global', 'local'] as const, path), lengthBasis: optionalEnum(source, 'lengthBasis', ['real', 'horizontal', 'vertical'] as const, path),
    pattern: optionalEnum(source, 'pattern', ['all', 'alternating-odd', 'alternating-even'] as const, path), force: optionalNum(source, 'force', path), eccentricity: optionalNum(source, 'eccentricity', path), label: optionalText(source, 'label', path) }) as Space3DGeneratedLoadSource;
};

const readMovingLoad = (value: unknown, index: number): Space3DMovingLoadCase => {
  const path = `movingLoadCases[${index}]`; const source = object(value, path);
  exactKeys(source, ['id', 'name', 'memberIds', 'targetMemberId', 'targetPosition', 'quantity', 'axles'], path, ['startNodeId', 'impactFactor']);
  const memberIds = list(source, 'memberIds', path).map((item, itemIndex) => typeof item === 'string' ? item : fail('not-a-string', `${path}.memberIds[${itemIndex}]`));
  if (memberIds.length === 0) fail('invalid-model', `${path}.memberIds debe incluir al menos un miembro`);
  if (new Set(memberIds).size !== memberIds.length) fail('invalid-model', `${path}.memberIds no puede repetir miembros`);
  const targetMemberId = text(source, 'targetMemberId', path);
  if (!memberIds.includes(targetMemberId)) fail('invalid-model', `${path}.targetMemberId debe pertenecer a memberIds`);
  const targetPosition = unitInterval(num(source, 'targetPosition', path), `${path}.targetPosition`);
  const axles = list(source, 'axles', path);
  if (axles.length === 0) fail('invalid-model', `${path}.axles debe incluir al menos un eje`);
  return compact({ id: text(source, 'id', path), name: text(source, 'name', path),
    memberIds, targetMemberId, targetPosition, quantity: enumField(source, 'quantity', ['R', 'N', 'V', 'M'] as const, path),
    startNodeId: optionalText(source, 'startNodeId', path), impactFactor: optionalNum(source, 'impactFactor', path),
    axles: axles.map((axle, axleIndex) => { const axlePath = `${path}.axles[${axleIndex}]`; const raw = object(axle, axlePath); exactKeys(raw, ['P', 'offset'], axlePath, ['id']); return compact({ id: optionalText(raw, 'id', axlePath), P: num(raw, 'P', axlePath), offset: num(raw, 'offset', axlePath) }); }),
  });
};

const assertProjectIdentitiesAndReferences = (project: Space3DProjectV1): void => {
  if (project.id.trim() === '') fail('invalid-model', 'project.id vacío');
  const ids = <T extends { readonly id: string }>(items: readonly T[], path: string): Set<string> => {
    const result = new Set<string>();
    items.forEach((item, index) => {
      if (item.id.trim() === '') fail('invalid-model', `${path}[${index}].id vacío`);
      if (result.has(item.id)) fail('invalid-model', `${path}[${index}].id duplicado «${item.id}»`);
      result.add(item.id);
    });
    return result;
  };
  const nodeIds = ids(project.nodes, 'nodes');
  const memberIds = ids(project.members, 'members');
  const caseIds = ids(project.loadCases, 'loadCases');
  ids(project.nodalLoads, 'nodalLoads'); ids(project.loadCombinations, 'loadCombinations');
  ids(project.prescribedDisplacements, 'prescribedDisplacements'); ids(project.memberLoads, 'memberLoads');
  ids(project.memberInitialEffects, 'memberInitialEffects'); ids(project.nodeLinks, 'nodeLinks');
  ids(project.multiPointConstraints, 'multiPointConstraints'); ids(project.nodalMasses, 'nodalMasses');
  ids(project.generatedLoadSources, 'generatedLoadSources'); ids(project.movingLoadCases, 'movingLoadCases');
  const reference = (set: ReadonlySet<string>, id: string | undefined, path: string) => {
    if (typeof id !== 'string' || !set.has(id)) fail('invalid-model', `${path}: missing-reference «${String(id)}»`);
  };
  project.members.forEach((item, index) => { reference(nodeIds, item.i, `members[${index}].i`); reference(nodeIds, item.j, `members[${index}].j`); if (item.i === item.j) fail('invalid-model', `members[${index}] es autorreferente`); });
  project.nodalLoads.forEach((item, index) => { reference(nodeIds, item.nodeId, `nodalLoads[${index}].nodeId`); reference(caseIds, item.caseId, `nodalLoads[${index}].caseId`); });
  project.loadCombinations.forEach((item, index) => item.terms.forEach((term, termIndex) => reference(caseIds, term.caseId, `loadCombinations[${index}].terms[${termIndex}].caseId`)));
  project.prescribedDisplacements.forEach((item, index) => { reference(nodeIds, item.nodeId, `prescribedDisplacements[${index}].nodeId`); reference(caseIds, item.caseId, `prescribedDisplacements[${index}].caseId`); });
  project.memberLoads.forEach((item, index) => { reference(memberIds, item.memberId, `memberLoads[${index}].memberId`); reference(caseIds, item.caseId, `memberLoads[${index}].caseId`); });
  project.memberInitialEffects.forEach((item, index) => { reference(memberIds, item.memberId, `memberInitialEffects[${index}].memberId`); reference(caseIds, item.caseId, `memberInitialEffects[${index}].caseId`); });
  project.nodeLinks.forEach((item, index) => { reference(nodeIds, item.nodeI, `nodeLinks[${index}].nodeI`); if (item.nodeJ !== undefined) { reference(nodeIds, item.nodeJ, `nodeLinks[${index}].nodeJ`); if (item.nodeJ === item.nodeI) fail('invalid-model', `nodeLinks[${index}] es autorreferente`); } });
  project.multiPointConstraints.forEach((item, index) => {
    if (item.terms.length < 2) fail('invalid-model', `multiPointConstraints[${index}].terms debe contener al menos dos términos`);
    if (!item.terms.some((term) => Math.abs(term.coefficient) > 0)) fail('invalid-model', `multiPointConstraints[${index}].terms debe incluir un coeficiente no nulo`);
    item.terms.forEach((term, termIndex) => reference(nodeIds, term.nodeId, `multiPointConstraints[${index}].terms[${termIndex}].nodeId`));
  });
  project.nodalMasses.forEach((item, index) => reference(nodeIds, item.nodeId, `nodalMasses[${index}].nodeId`));
  project.generatedLoadSources.forEach((item, index) => {
    if (item.memberIds.length === 0) fail('invalid-model', `generatedLoadSources[${index}].memberIds debe incluir al menos un miembro`);
    const seen = new Set<string>();
    item.memberIds.forEach((id, memberIndex) => { reference(memberIds, id, `generatedLoadSources[${index}].memberIds[${memberIndex}]`); if (seen.has(id)) fail('invalid-model', `generatedLoadSources[${index}].memberIds duplicado «${id}»`); seen.add(id); });
    if (item.caseId !== undefined) reference(caseIds, item.caseId, `generatedLoadSources[${index}].caseId`);
  });
  project.movingLoadCases.forEach((item, index) => {
    if (item.memberIds.length === 0) fail('invalid-model', `movingLoadCases[${index}].memberIds debe incluir al menos un miembro`);
    const seen = new Set<string>();
    item.memberIds.forEach((id, memberIndex) => { reference(memberIds, id, `movingLoadCases[${index}].memberIds[${memberIndex}]`); if (seen.has(id)) fail('invalid-model', `movingLoadCases[${index}].memberIds duplicado «${id}»`); seen.add(id); });
    reference(memberIds, item.targetMemberId, `movingLoadCases[${index}].targetMemberId`);
    if (!item.memberIds.includes(item.targetMemberId)) fail('invalid-model', `movingLoadCases[${index}].targetMemberId debe pertenecer a memberIds`);
    if (item.startNodeId !== undefined) reference(nodeIds, item.startNodeId, `movingLoadCases[${index}].startNodeId`);
    const axleIds = new Set<string>(); item.axles.forEach((axle, axleIndex) => { if (axle.id === undefined) return; if (axleIds.has(axle.id)) fail('invalid-model', `movingLoadCases[${index}].axles[${axleIndex}].id duplicado «${axle.id}»`); axleIds.add(axle.id); });
  });
};

export interface Space3DParseOptions {
  /**
   * Exige además un modelo estructuralmente admisible.
   *
   * Un archivo puede tener la forma correcta y aun así describir un modelo que
   * no se puede analizar — por ejemplo el derivado de un proyecto 2D, con la
   * inercia del eje débil todavía a cero. Eso es trabajo en curso legítimo: se
   * guarda y se reabre, y es el validador quien impide analizarlo. Un archivo
   * que llega de fuera sí se exige coherente.
   */
  readonly requireAdmissibleModel?: boolean;
}

export const parseSpace3DProject = (json: string, options: Space3DParseOptions = {}): Space3DProjectV1 => {
  const requireAdmissibleModel = options.requireAdmissibleModel ?? true;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Space3DCodecError('malformed-json', 'el archivo no es JSON válido');
  }
  const source = object(raw, 'project');

  // La discriminación va primero: así un archivo 2D falla por lo que es, y no
  // por el primer campo que le falte.
  if (source.analysisSpace !== SPACE3D_ANALYSIS_SPACE) {
    fail('analysis-space', `se esperaba «${SPACE3D_ANALYSIS_SPACE}» y llegó «${String(source.analysisSpace)}»`);
  }
  if (source.schemaVersion !== SPACE3D_SCHEMA_VERSION && source.schemaVersion !== SPACE3D_LEGACY_SCHEMA_VERSION) {
    fail('schema-version', `se esperaba ${SPACE3D_LEGACY_SCHEMA_VERSION} o ${SPACE3D_SCHEMA_VERSION} y llegó ${String(source.schemaVersion)}`);
  }

  const legacy = source.schemaVersion === SPACE3D_LEGACY_SCHEMA_VERSION;
  const coreFields = ['analysisSpace', 'schemaVersion', 'id', 'name', 'units', 'nodes', 'members', 'nodalLoads', 'loadCases', 'loadCombinations'];
  const semanticFields = ['prescribedDisplacements', 'memberLoads', 'memberInitialEffects', 'nodeLinks', 'multiPointConstraints', 'nodalMasses', 'generatedLoadSources', 'movingLoadCases'];
  exactKeys(source, legacy ? coreFields : [...coreFields, ...semanticFields], 'project');

  const units = text(source, 'units', 'project');
  if (!isUnitSystemId(units)) fail('not-a-string', `project.units «${units}»`);

  const project: Space3DProjectV1 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: text(source, 'id', 'project'),
    name: text(source, 'name', 'project'),
    units: units as Space3DProjectV1['units'],
    nodes: list(source, 'nodes', 'project').map(readNode),
    members: list(source, 'members', 'project').map(readMember),
    nodalLoads: list(source, 'nodalLoads', 'project').map(readLoad),
    loadCases: list(source, 'loadCases', 'project').map(readCase),
    loadCombinations: list(source, 'loadCombinations', 'project').map(readCombination),
    prescribedDisplacements: legacy ? [] : list(source, 'prescribedDisplacements', 'project').map(readPrescribedDisplacement),
    memberLoads: legacy ? [] : list(source, 'memberLoads', 'project').map(readMemberLoad),
    memberInitialEffects: legacy ? [] : list(source, 'memberInitialEffects', 'project').map(readInitialEffect),
    nodeLinks: legacy ? [] : list(source, 'nodeLinks', 'project').map(readNodeLink),
    multiPointConstraints: legacy ? [] : list(source, 'multiPointConstraints', 'project').map(readMpc),
    nodalMasses: legacy ? [] : list(source, 'nodalMasses', 'project').map(readNodalMass),
    generatedLoadSources: legacy ? [] : list(source, 'generatedLoadSources', 'project').map(readGeneratedSource),
    movingLoadCases: legacy ? [] : list(source, 'movingLoadCases', 'project').map(readMovingLoad),
  };
  assertProjectIdentitiesAndReferences(project);

  if (requireAdmissibleModel) {
    const issues = validateSpace3DProject(project);
    if (issues.length > 0) {
      const detail = issues.slice(0, 3).map((item) => `${item.entityKind}:${item.entityId}:${item.code}`).join(', ');
      fail('invalid-model', `${issues.length} problema(s): ${detail}`);
    }
  }

  return project;
};

/** Lectura de trabajo en curso: forma estricta, admisibilidad no exigida. */
export const parseSpace3DDraft = (json: string): Space3DProjectV1 =>
  parseSpace3DProject(json, { requireAdmissibleModel: false });

export const serializeSpace3DProject = (project: Space3DProjectV1): string => JSON.stringify(project, null, 2);
