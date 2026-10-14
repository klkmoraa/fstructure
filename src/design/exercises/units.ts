/**
 * Unidades de los ejercicios.
 *
 * Por dentro todo va en N·mm (mm, MPa, kN, kN·m, mm², kN/m, kPa); el sistema
 * elegido sólo cambia lo que se muestra y lo que se captura. «kgf» es el de los
 * libros mexicanos (cm, kg/cm², t, t·m); «SI», el de las normas recientes.
 */
export type UnitSystem = 'kgf' | 'si';

export type QuantityKind =
  | 'section' // dimensiones de la sección
  | 'span' // longitudes de miembro
  | 'stress'
  | 'force'
  | 'moment'
  | 'area'
  | 'line' // carga por unidad de longitud
  | 'pressure' // presión del suelo
  | 'diameter'
  | 'spacing'
  | 'deflection'
  | 'count'
  | 'ratio'
  | 'factor'
  | 'strain'
  | 'percent'
  | 'flag';

const G = 9.80665;

interface UnitSpec { readonly unit: string; readonly scale: number; readonly digits: number }

/** `scale`: valor mostrado = valor interno × scale. */
const SPECS: Record<UnitSystem, Record<QuantityKind, UnitSpec>> = {
  kgf: {
    section: { unit: 'cm', scale: 0.1, digits: 2 },
    span: { unit: 'm', scale: 1, digits: 2 },
    stress: { unit: 'kg/cm²', scale: 1 / (G / 100), digits: 1 },
    force: { unit: 't', scale: 1 / G, digits: 2 },
    moment: { unit: 't·m', scale: 1 / G, digits: 2 },
    area: { unit: 'cm²', scale: 0.01, digits: 2 },
    line: { unit: 't/m', scale: 1 / G, digits: 2 },
    pressure: { unit: 't/m²', scale: 1 / G, digits: 2 },
    diameter: { unit: 'mm', scale: 1, digits: 1 },
    spacing: { unit: 'cm', scale: 0.1, digits: 1 },
    deflection: { unit: 'cm', scale: 0.1, digits: 3 },
    count: { unit: '', scale: 1, digits: 0 },
    ratio: { unit: '', scale: 1, digits: 4 },
    factor: { unit: '', scale: 1, digits: 3 },
    strain: { unit: '', scale: 1, digits: 5 },
    percent: { unit: '%', scale: 1, digits: 1 },
    flag: { unit: '', scale: 1, digits: 0 },
  },
  si: {
    section: { unit: 'mm', scale: 1, digits: 1 },
    span: { unit: 'm', scale: 1, digits: 2 },
    stress: { unit: 'MPa', scale: 1, digits: 2 },
    force: { unit: 'kN', scale: 1, digits: 1 },
    moment: { unit: 'kN·m', scale: 1, digits: 1 },
    area: { unit: 'mm²', scale: 1, digits: 0 },
    line: { unit: 'kN/m', scale: 1, digits: 2 },
    pressure: { unit: 'kPa', scale: 1, digits: 1 },
    diameter: { unit: 'mm', scale: 1, digits: 1 },
    spacing: { unit: 'mm', scale: 1, digits: 0 },
    deflection: { unit: 'mm', scale: 1, digits: 2 },
    count: { unit: '', scale: 1, digits: 0 },
    ratio: { unit: '', scale: 1, digits: 4 },
    factor: { unit: '', scale: 1, digits: 3 },
    strain: { unit: '', scale: 1, digits: 5 },
    percent: { unit: '%', scale: 1, digits: 1 },
    flag: { unit: '', scale: 1, digits: 0 },
  },
};

export const unitOf = (system: UnitSystem, kind: QuantityKind): string => SPECS[system][kind].unit;
export const toDisplay = (system: UnitSystem, kind: QuantityKind, value: number): number => value * SPECS[system][kind].scale;
export const fromDisplay = (system: UnitSystem, kind: QuantityKind, value: number): number => value / SPECS[system][kind].scale;
export const digitsOf = (system: UnitSystem, kind: QuantityKind): number => SPECS[system][kind].digits;

const formatter = new Map<number, Intl.NumberFormat>();
/** Número con hasta `digits` decimales, sin ceros sobrantes. */
export const formatPlain = (value: number, digits: number): string => {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—';
  let format = formatter.get(digits);
  if (!format) {
    format = new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    formatter.set(digits, format);
  }
  const text = format.format(Math.abs(value) < 10 ** -(digits + 1) ? 0 : value);
  return text.replace('-', '−');
};

/** Valor en las unidades elegidas, sin unidad. */
export const formatValue = (system: UnitSystem, kind: QuantityKind, value: number): string =>
  formatPlain(toDisplay(system, kind, value), digitsOf(system, kind));

/** Valor con su unidad («30 cm», «250 kg/cm²»). */
export const formatQuantity = (system: UnitSystem, kind: QuantityKind, value: number): string => {
  const unit = unitOf(system, kind);
  const number = formatValue(system, kind, value);
  return unit ? (unit === '%' ? `${number} %` : `${number} ${unit}`) : number;
};

/** Paso de redondeo constructivo de una dimensión, en mm (5 cm en kgf, 50 mm en SI). */
export const DIMENSION_STEP_MM = 50;
