import {
  createCustomUnitSystemId,
  isBuiltInUnitSystemId,
  parseCustomUnitSystemId,
  toDisplay,
  UNIT_FORCE_IDS,
  UNIT_LENGTH_IDS,
  UNIT_QUANTITIES,
  UNIT_SYSTEM_IDS,
} from '../foundation/units';
import type {
  BuiltInUnitSystemId,
  UnitForceId,
  UnitLengthId,
  UnitQuantity,
  UnitSystemId,
} from '../foundation/units';

/** 2D selector option, including the display label chosen by this surface. */
export interface UnitOption<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
}

export const FORCE_UNIT_OPTIONS: readonly UnitOption<UnitForceId>[] = UNIT_FORCE_IDS.map((id) => ({ id, label: id }));

export const LENGTH_UNIT_OPTIONS: readonly UnitOption<UnitLengthId>[] = UNIT_LENGTH_IDS.map((id) => ({ id, label: id }));

export interface UnitSystemProfile {
  readonly id: BuiltInUnitSystemId;
  readonly label: string;
}

/** Display labels and order for the 2D selector. Canonical IDs remain in Foundation. */
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

type UnitLabels = Readonly<Record<UnitQuantity, string>>;

const massLabelByForce: Record<UnitForceId, string> = {
  N: 'kg',
  kN: 'kg',
  MN: 'kg',
  gf: 'g',
  kgf: 'kg',
  t: 't',
  lb: 'lb',
  kip: 'lb',
};

const makeLabels = (force: UnitForceId, length: UnitLengthId): UnitLabels => {
  const elasticModulus = force === 'N' && length === 'mm'
    ? 'MPa'
    : force === 'kN' && length === 'm'
      ? 'MPa'
      : force === 'kgf' && length === 'cm'
        ? 'kgf/cm²'
        : force === 'kip' && length === 'in'
          ? 'ksi'
          : `${force}/${length}²`;
  return {
    length,
    force,
    moment: `${force}·${length}`,
    distributedForce: `${force}/${length}`,
    elasticModulus,
    area: `${length}²`,
    inertia: `${length}⁴`,
    sectionModulus: `${length}³`,
    sectionDimension: length,
    translationalStiffness: `${force}/${length}`,
    rotationalStiffness: `${force}·${length}/rad`,
    density: `${massLabelByForce[force]}/${length}³`,
  };
};

const builtInLabels: Record<BuiltInUnitSystemId, UnitLabels> = {
  // These four profiles preserve the labels of historical projects.
  'kN-m': {
    length: 'm', force: 'kN', moment: 'kN·m', distributedForce: 'kN/m',
    elasticModulus: 'MPa', area: 'm²', inertia: 'm⁴', sectionModulus: 'm³',
    sectionDimension: 'mm',
    translationalStiffness: 'kN/m', rotationalStiffness: 'kN·m/rad', density: 'kg/m³',
  },
  'N-mm': {
    length: 'mm', force: 'N', moment: 'N·mm', distributedForce: 'N/mm',
    elasticModulus: 'MPa', area: 'mm²', inertia: 'mm⁴', sectionModulus: 'mm³',
    sectionDimension: 'mm',
    translationalStiffness: 'N/mm', rotationalStiffness: 'N·mm/rad', density: 'kg/m³',
  },
  'kgf-m': {
    length: 'm', force: 'kgf', moment: 'kgf·m', distributedForce: 'kgf/m',
    elasticModulus: 'kgf/cm²', area: 'cm²', inertia: 'cm⁴', sectionModulus: 'cm³',
    sectionDimension: 'cm',
    translationalStiffness: 'kgf/m', rotationalStiffness: 'kgf·m/rad', density: 'kg/m³',
  },
  'kip-ft': {
    length: 'ft', force: 'kip', moment: 'kip·ft', distributedForce: 'kip/ft',
    elasticModulus: 'ksi', area: 'in²', inertia: 'in⁴', sectionModulus: 'in³',
    sectionDimension: 'in',
    translationalStiffness: 'kip/ft', rotationalStiffness: 'kip·ft/rad', density: 'lb/ft³',
  },
  'N-m': makeLabels('N', 'm'),
  'kN-cm': makeLabels('kN', 'cm'),
  'kN-mm': makeLabels('kN', 'mm'),
  'kgf-cm': makeLabels('kgf', 'cm'),
  't-m': makeLabels('t', 'm'),
  't-cm': makeLabels('t', 'cm'),
  'lb-ft': makeLabels('lb', 'ft'),
  'lb-in': makeLabels('lb', 'in'),
  'kip-in': makeLabels('kip', 'in'),
  'MN-m': makeLabels('MN', 'm'),
};

export const unitSystemLabel = (system: UnitSystemId): string =>
  parseCustomUnitSystemId(system)?.name
    ?? UNIT_SYSTEM_PROFILES.find((profile) => profile.id === system)?.label
    ?? UNIT_SYSTEM_PROFILES[0].label;

const labelsFor = (system: UnitSystemId): UnitLabels => {
  if (isBuiltInUnitSystemId(system)) return builtInLabels[system];
  const custom = parseCustomUnitSystemId(system);
  return custom ? makeLabels(custom.force, custom.length) : builtInLabels['kN-m'];
};

export const unitLabel = (system: UnitSystemId, quantity: UnitQuantity): string =>
  labelsFor(system)[quantity];

export const formatDisplay = (
  value: number,
  system: UnitSystemId,
  quantity: UnitQuantity,
  digits = 3,
): string => {
  const converted = toDisplay(value, system, quantity);
  const magnitude = Math.abs(converted);
  if ((magnitude > 0 && magnitude < 10 ** (-digits)) || magnitude >= 1e7) return `${converted.toExponential(digits)} ${unitLabel(system, quantity)}`;
  return `${converted.toFixed(digits)} ${unitLabel(system, quantity)}`;
};

/**
 * Every label produced by the built-in profiles or by any valid custom
 * force/length pair. PDF equations use this set to distinguish a final unit
 * from a variable named with the same letter.
 */
export const ALL_UNIT_LABELS: ReadonlySet<string> = new Set([
  'rad',
  ...UNIT_SYSTEM_IDS.flatMap((system) => UNIT_QUANTITIES.map((quantity) => unitLabel(system, quantity))),
  ...UNIT_FORCE_IDS.flatMap((force) => UNIT_LENGTH_IDS.flatMap((length) => {
    const custom = createCustomUnitSystemId('custom', force, length);
    return UNIT_QUANTITIES.map((quantity) => unitLabel(custom, quantity));
  })),
]);

/**
 * @deprecated Import neutral unit IDs, parsing, validation and conversions
 * directly from `foundation/units`. This compatibility surface will be removed
 * after downstream integrations migrate.
 */
export {
  createCustomUnitSystemId,
  fromDisplay,
  isBuiltInUnitSystemId,
  isCustomUnitSystemId,
  isUnitSystemId,
  parseCustomUnitSystemId,
  toDisplay,
  unitSystemIdentity,
  UNIT_FORCE_IDS,
  UNIT_LENGTH_IDS,
  UNIT_QUANTITIES,
  UNIT_SYSTEM_IDS,
} from '../foundation/units';

/** @deprecated Import neutral unit types directly from `foundation/units`. */
export type {
  BuiltInUnitSystemId,
  CustomUnitSystem,
  UnitFactors,
  UnitForceId,
  UnitLengthId,
  UnitQuantity,
  UnitSystemId,
  UnitSystemIdentity,
} from '../foundation/units';
