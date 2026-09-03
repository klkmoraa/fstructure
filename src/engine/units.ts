import type { BuiltInUnitSystemId, UnitSystemId } from '../types';

export const UNIT_QUANTITIES = [
  'length',
  'force',
  'moment',
  'distributedForce',
  'elasticModulus',
  'area',
  'inertia',
  'sectionModulus',
  'sectionDimension',
  'translationalStiffness',
  'rotationalStiffness',
  'density',
] as const;

export type UnitQuantity = (typeof UNIT_QUANTITIES)[number];
export type UnitForceId = 'N' | 'kN' | 'MN' | 'gf' | 'kgf' | 't' | 'lb' | 'kip';
export type UnitLengthId = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd';

export interface UnitOption<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
}

interface UnitDefinition {
  labels: Record<UnitQuantity, string>;
  factors: Record<UnitQuantity, number>;
}

interface ForceDefinition extends UnitOption<UnitForceId> {
  readonly factor: number;
  readonly massLabel: string;
  /** Number of display mass units represented by one kilogram. */
  readonly massFactor: number;
}

interface LengthDefinition extends UnitOption<UnitLengthId> {
  /** Number of display length units represented by one metre. */
  readonly factor: number;
}

const forceDefinitions: Record<UnitForceId, ForceDefinition> = {
  N: { id: 'N', label: 'N', factor: 1_000, massLabel: 'kg', massFactor: 1 },
  kN: { id: 'kN', label: 'kN', factor: 1, massLabel: 'kg', massFactor: 1 },
  MN: { id: 'MN', label: 'MN', factor: 0.001, massLabel: 'kg', massFactor: 1 },
  gf: { id: 'gf', label: 'gf', factor: 101_971.6212978, massLabel: 'g', massFactor: 1_000 },
  kgf: { id: 'kgf', label: 'kgf', factor: 101.9716212978, massLabel: 'kg', massFactor: 1 },
  t: { id: 't', label: 't', factor: 0.1019716212978, massLabel: 't', massFactor: 0.001 },
  lb: { id: 'lb', label: 'lb', factor: 224.80894387096, massLabel: 'lb', massFactor: 2.20462262185 },
  kip: { id: 'kip', label: 'kip', factor: 0.22480894387096, massLabel: 'lb', massFactor: 2.20462262185 },
};

const lengthDefinitions: Record<UnitLengthId, LengthDefinition> = {
  mm: { id: 'mm', label: 'mm', factor: 1_000 },
  cm: { id: 'cm', label: 'cm', factor: 100 },
  m: { id: 'm', label: 'm', factor: 1 },
  km: { id: 'km', label: 'km', factor: 0.001 },
  in: { id: 'in', label: 'in', factor: 39.37007874015748 },
  ft: { id: 'ft', label: 'ft', factor: 3.280839895013123 },
  yd: { id: 'yd', label: 'yd', factor: 1.0936132983377078 },
};

export const FORCE_UNIT_OPTIONS: readonly UnitOption<UnitForceId>[] = [
  { id: 'N', label: 'N' },
  { id: 'kN', label: 'kN' },
  { id: 'MN', label: 'MN' },
  { id: 'gf', label: 'gf' },
  { id: 'kgf', label: 'kgf' },
  { id: 't', label: 't' },
  { id: 'lb', label: 'lb' },
  { id: 'kip', label: 'kip' },
];

export const LENGTH_UNIT_OPTIONS: readonly UnitOption<UnitLengthId>[] = [
  { id: 'mm', label: 'mm' },
  { id: 'cm', label: 'cm' },
  { id: 'm', label: 'm' },
  { id: 'km', label: 'km' },
  { id: 'in', label: 'in' },
  { id: 'ft', label: 'ft' },
  { id: 'yd', label: 'yd' },
];

export interface UnitSystemProfile {
  readonly id: BuiltInUnitSystemId;
  readonly label: string;
}

export const UNIT_SYSTEM_PROFILES: readonly UnitSystemProfile[] = [
  { id: 'kN-m', label: 'kN · m' },
  { id: 'N-mm', label: 'N · mm' },
  { id: 'kgf-m', label: 'kgf · m' },
  { id: 'kip-ft', label: 'kip · ft' },
  { id: 'N-m', label: 'N · m' },
  { id: 'kN-cm', label: 'kN · cm' },
  { id: 'kN-mm', label: 'kN · mm' },
  { id: 'kgf-cm', label: 'kgf · cm' },
  { id: 't-m', label: 't · m' },
  { id: 't-cm', label: 't · cm' },
  { id: 'lb-ft', label: 'lb · ft' },
  { id: 'lb-in', label: 'lb · in' },
  { id: 'kip-in', label: 'kip · in' },
  { id: 'MN-m', label: 'MN · m' },
];

export const UNIT_SYSTEM_IDS: readonly BuiltInUnitSystemId[] =
  UNIT_SYSTEM_PROFILES.map((profile) => profile.id);

const customUnitSystemPrefix = 'custom:';

const makeDefinition = (forceId: UnitForceId, lengthId: UnitLengthId): UnitDefinition => {
  const force = forceDefinitions[forceId];
  const length = lengthDefinitions[lengthId];
  const lengthFactor = length.factor;
  const forceFactor = force.factor;
  const modulusLabel = forceId === 'N' && lengthId === 'mm'
    ? 'MPa'
    : forceId === 'kN' && lengthId === 'm'
      ? 'MPa'
      : forceId === 'kgf' && lengthId === 'cm'
        ? 'kgf/cm²'
        : forceId === 'kip' && lengthId === 'in'
          ? 'ksi'
          : force.label + '/' + length.label + '²';
  return {
    labels: {
      length: length.label,
      force: force.label,
      moment: force.label + '·' + length.label,
      distributedForce: force.label + '/' + length.label,
      elasticModulus: modulusLabel,
      area: length.label + '²',
      inertia: length.label + '⁴',
      sectionModulus: length.label + '³',
      sectionDimension: length.label,
      translationalStiffness: force.label + '/' + length.label,
      rotationalStiffness: force.label + '·' + length.label + '/rad',
      density: force.massLabel + '/' + length.label + '³',
    },
    factors: {
      length: lengthFactor,
      force: forceFactor,
      moment: forceFactor * lengthFactor,
      distributedForce: forceFactor / lengthFactor,
      elasticModulus: forceFactor / lengthFactor ** 2,
      area: lengthFactor ** 2,
      inertia: lengthFactor ** 4,
      sectionModulus: lengthFactor ** 3,
      sectionDimension: lengthFactor,
      translationalStiffness: forceFactor / lengthFactor,
      rotationalStiffness: forceFactor * lengthFactor,
      density: force.massFactor / lengthFactor ** 3,
    },
  };
};

const definitions: Record<BuiltInUnitSystemId, UnitDefinition> = {
  // These four profiles preserve the labels and conversions used by existing projects.
  'kN-m': {
    labels: {
      length: 'm', force: 'kN', moment: 'kN·m', distributedForce: 'kN/m',
      elasticModulus: 'MPa', area: 'm²', inertia: 'm⁴', sectionModulus: 'm³',
      sectionDimension: 'mm',
      translationalStiffness: 'kN/m', rotationalStiffness: 'kN·m/rad', density: 'kg/m³',
    },
    factors: {
      length: 1, force: 1, moment: 1, distributedForce: 1,
      elasticModulus: 1 / 1000, area: 1, inertia: 1, sectionModulus: 1,
      sectionDimension: 1000,
      translationalStiffness: 1, rotationalStiffness: 1, density: 1,
    },
  },
  'N-mm': {
    labels: {
      length: 'mm', force: 'N', moment: 'N·mm', distributedForce: 'N/mm',
      elasticModulus: 'MPa', area: 'mm²', inertia: 'mm⁴', sectionModulus: 'mm³',
      sectionDimension: 'mm',
      translationalStiffness: 'N/mm', rotationalStiffness: 'N·mm/rad', density: 'kg/m³',
    },
    factors: {
      length: 1000, force: 1000, moment: 1_000_000, distributedForce: 1,
      elasticModulus: 1 / 1000, area: 1_000_000, inertia: 1_000_000_000_000, sectionModulus: 1_000_000_000,
      sectionDimension: 1000,
      translationalStiffness: 1, rotationalStiffness: 1_000_000, density: 1,
    },
  },
  'kgf-m': {
    labels: {
      length: 'm', force: 'kgf', moment: 'kgf·m', distributedForce: 'kgf/m',
      elasticModulus: 'kgf/cm²', area: 'cm²', inertia: 'cm⁴', sectionModulus: 'cm³',
      sectionDimension: 'cm',
      translationalStiffness: 'kgf/m', rotationalStiffness: 'kgf·m/rad', density: 'kg/m³',
    },
    factors: {
      length: 1, force: 101.9716212978, moment: 101.9716212978, distributedForce: 101.9716212978,
      elasticModulus: 0.01019716212978, area: 10_000, inertia: 100_000_000, sectionModulus: 1_000_000,
      sectionDimension: 100,
      translationalStiffness: 101.9716212978, rotationalStiffness: 101.9716212978, density: 1,
    },
  },
  'kip-ft': {
    labels: {
      length: 'ft', force: 'kip', moment: 'kip·ft', distributedForce: 'kip/ft',
      elasticModulus: 'ksi', area: 'in²', inertia: 'in⁴', sectionModulus: 'in³',
      sectionDimension: 'in',
      translationalStiffness: 'kip/ft', rotationalStiffness: 'kip·ft/rad', density: 'lb/ft³',
    },
    factors: {
      length: 3.28083989501312,
      force: 0.22480894387096,
      moment: 0.73756214927727,
      distributedForce: 0.06852176585679,
      elasticModulus: 1.45037737730209e-4,
      area: 1550.0031000062,
      inertia: 2_402_509.60999038,
      sectionModulus: 61_023.7440947323,
      sectionDimension: 39.3700787401575,
      translationalStiffness: 0.06852176585679,
      rotationalStiffness: 0.73756214927727,
      density: 0.0624279605761,
    },
  },
  'N-m': makeDefinition('N', 'm'),
  'kN-cm': makeDefinition('kN', 'cm'),
  'kN-mm': makeDefinition('kN', 'mm'),
  'kgf-cm': makeDefinition('kgf', 'cm'),
  't-m': makeDefinition('t', 'm'),
  't-cm': makeDefinition('t', 'cm'),
  'lb-ft': makeDefinition('lb', 'ft'),
  'lb-in': makeDefinition('lb', 'in'),
  'kip-in': makeDefinition('kip', 'in'),
  'MN-m': makeDefinition('MN', 'm'),
};

export interface CustomUnitSystem {
  readonly name: string;
  readonly force: UnitForceId;
  readonly length: UnitLengthId;
}

const hasForce = (value: string): value is UnitForceId =>
  Object.prototype.hasOwnProperty.call(forceDefinitions, value);

const hasLength = (value: string): value is UnitLengthId =>
  Object.prototype.hasOwnProperty.call(lengthDefinitions, value);

const normalizeCustomName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

export const parseCustomUnitSystemId = (value: unknown): CustomUnitSystem | null => {
  if (typeof value !== 'string' || !value.startsWith(customUnitSystemPrefix)) return null;
  const parts = value.slice(customUnitSystemPrefix.length).split(':');
  if (parts.length !== 3 || !parts[0] || !hasForce(parts[1]) || !hasLength(parts[2])) return null;
  let decodedName: string;
  try {
    decodedName = decodeURIComponent(parts[0]);
  } catch {
    return null;
  }
  const name = normalizeCustomName(decodedName);
  if (!name || name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return { name, force: parts[1], length: parts[2] };
};

export const createCustomUnitSystemId = (
  name: string,
  force: UnitForceId,
  length: UnitLengthId,
): UnitSystemId => {
  if (!hasForce(force) || !hasLength(length)) throw new Error('Unidad personalizada no disponible.');
  const normalizedName = normalizeCustomName(name) || forceDefinitions[force].label + '/' + lengthDefinitions[length].label;
  if (normalizedName.length > 64 || /[\u0000-\u001f\u007f]/.test(normalizedName)) {
    throw new Error('El nombre de la unidad personalizada no es válido.');
  }
  return (customUnitSystemPrefix + encodeURIComponent(normalizedName) + ':' + force + ':' + length) as UnitSystemId;
};

export const isBuiltInUnitSystemId = (value: unknown): value is BuiltInUnitSystemId =>
  typeof value === 'string' && UNIT_SYSTEM_IDS.includes(value as BuiltInUnitSystemId);

export const isCustomUnitSystemId = (value: unknown): value is UnitSystemId =>
  parseCustomUnitSystemId(value) !== null;

export const isUnitSystemId = (value: unknown): value is UnitSystemId =>
  isBuiltInUnitSystemId(value) || isCustomUnitSystemId(value);

export const unitSystemLabel = (system: UnitSystemId): string =>
  parseCustomUnitSystemId(system)?.name
    ?? UNIT_SYSTEM_PROFILES.find((profile) => profile.id === system)?.label
    ?? UNIT_SYSTEM_PROFILES[0].label;

const definitionFor = (system: UnitSystemId): UnitDefinition => {
  if (isBuiltInUnitSystemId(system)) return definitions[system];
  const custom = parseCustomUnitSystemId(system);
  return custom ? makeDefinition(custom.force, custom.length) : definitions['kN-m'];
};

export const unitLabel = (system: UnitSystemId, quantity: UnitQuantity): string =>
  definitionFor(system).labels[quantity];

export const toDisplay = (value: number, system: UnitSystemId, quantity: UnitQuantity): number =>
  value * definitionFor(system).factors[quantity];

export const fromDisplay = (value: number, system: UnitSystemId, quantity: UnitQuantity): number =>
  value / definitionFor(system).factors[quantity];

export const formatDisplay = (
  value: number,
  system: UnitSystemId,
  quantity: UnitQuantity,
  digits = 3,
): string => {
  const converted = toDisplay(value, system, quantity);
  const magnitude = Math.abs(converted);
  if ((magnitude > 0 && magnitude < 10 ** (-digits)) || magnitude >= 1e7) return converted.toExponential(digits) + ' ' + unitLabel(system, quantity);
  return converted.toFixed(digits) + ' ' + unitLabel(system, quantity);
};

/**
 * Every label produced by the built-in profiles or by any valid custom
 * force/length pair. PDF equations use this set to distinguish a final unit
 * from a variable named with the same letter.
 */
export const ALL_UNIT_LABELS: ReadonlySet<string> = new Set([
  'rad',
  ...UNIT_SYSTEM_IDS.flatMap((system) => UNIT_QUANTITIES.map((quantity) => unitLabel(system, quantity))),
  ...Object.keys(forceDefinitions).flatMap((force) => Object.keys(lengthDefinitions).flatMap((length) => {
    const custom = createCustomUnitSystemId('custom', force as UnitForceId, length as UnitLengthId);
    return UNIT_QUANTITIES.map((quantity) => unitLabel(custom, quantity));
  })),
]);
