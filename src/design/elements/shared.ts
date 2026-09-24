import { betaOne, equivalentBlockStrengthMpa } from '../concrete/ntcConcrete2023';

export { betaOne, equivalentBlockStrengthMpa };

export const STEEL_ELASTIC_MODULUS_MPA = 200_000;
export const CONCRETE_ULTIMATE_STRAIN = 0.003;
export const CONCRETE_UNIT_WEIGHT_KN_M3 = 24;
export const KGF_CM2_PER_MPA = 10.197_162;

export interface RebarSize {
  readonly label: string;
  readonly diameterMm: number;
}

/**
 * Varillas corrugadas comerciales en México (número en octavos de pulgada).
 * El catálogo termina en la #10: la tabla 14.4.2.4 de la NTC 2023 separa las
 * longitudes de desarrollo en «no. 6 y menores» y «no. 7 a no. 11»; la #12
 * mexicana (38.1 mm) queda fuera de ambos renglones verificados.
 */
export const REBAR_SIZES: readonly RebarSize[] = Object.freeze([
  { label: '#3', diameterMm: 9.5 },
  { label: '#4', diameterMm: 12.7 },
  { label: '#5', diameterMm: 15.9 },
  { label: '#6', diameterMm: 19.1 },
  { label: '#8', diameterMm: 25.4 },
  { label: '#10', diameterMm: 31.8 },
]);

export const rebarLabel = (diameterMm: number): string =>
  REBAR_SIZES.find((size) => Math.abs(size.diameterMm - diameterMm) < 0.05)?.label ?? `Ø${diameterMm}`;

export const barArea = (diameterMm: number): number => Math.PI * diameterMm ** 2 / 4;

/** Normas del registro `docs/design/normative-sources.json` que el taller puede citar. */
export type NormativeStandardId =
  | 'ntc-cdmx-2023-concrete'
  | 'ntc-cdmx-2023-criteria-actions'
  | 'nsr-10-titulo-c'
  | 'e060-2009-concreto-armado';

/**
 * Referencia normativa de una comprobación. `clauseIds` nombra cláusulas
 * registradas con evidencia en `docs/design/normative-sources.json` bajo la
 * norma `standard`; una prueba rechaza cualquier id que no esté ahí. Lo que no
 * proviene de una cláusula verificada se declara como `complementary` y se
 * muestra así en la interfaz.
 */
export interface ClauseReference {
  readonly standard: NormativeStandardId | 'complementary';
  readonly clauseIds: readonly string[];
  readonly label: string;
}

/** Id corto para la etiqueta: «5.5.3.2.1 y 5.5.3.8.1» → «5.5.3.2.1»; las tablas se nombran completas. */
const shortClause = (id: string) => /^tabla /i.test(id) ? id : id.split(' ')[0]!;

const reference = (standard: NormativeStandardId, prefix: string) => (...clauseIds: string[]): ClauseReference => ({
  standard,
  clauseIds,
  label: `${prefix} ${clauseIds.map(shortClause).join(' · ')}`,
});

export const ntc = reference('ntc-cdmx-2023-concrete', 'NTC-C');
export const ntcActions = reference('ntc-cdmx-2023-criteria-actions', 'NTC-CyA');
export const nsr = reference('nsr-10-titulo-c', 'NSR-10');
export const e060 = reference('e060-2009-concreto-armado', 'E.060');

/** Criterio que no sale de una cláusula verificada (estática, práctica constructiva, dato geotécnico). */
export const complementary = (label: string): ClauseReference => ({ standard: 'complementary', clauseIds: [], label });

export type CheckStatus = 'pass' | 'fail' | 'warning' | 'info';

export interface ElementCheck {
  readonly id: string;
  readonly label: string;
  readonly status: CheckStatus;
  readonly demand?: number;
  readonly capacity?: number;
  readonly unit?: string;
  /** demanda/capacidad, cuando el cociente tiene sentido físico. */
  readonly ratio?: number;
  readonly reference: ClauseReference;
  readonly note?: string;
}

export const capacityCheck = (
  id: string,
  label: string,
  demand: number,
  capacity: number,
  unit: string,
  reference: ClauseReference,
  note?: string,
): ElementCheck => ({
  id,
  label,
  demand,
  capacity,
  unit,
  reference,
  note,
  ratio: capacity > 0 ? demand / capacity : Number.POSITIVE_INFINITY,
  status: demand <= capacity * (1 + 1e-9) ? 'pass' : 'fail',
});

export const governingRatio = (checks: readonly ElementCheck[]): number =>
  checks.reduce((max, item) => item.ratio !== undefined && Number.isFinite(item.ratio) && item.status !== 'info' ? Math.max(max, item.ratio) : max, 0);

export const overallStatus = (checks: readonly ElementCheck[]): 'pass' | 'fail' | 'warning' =>
  checks.some((item) => item.status === 'fail') ? 'fail' : checks.some((item) => item.status === 'warning') ? 'warning' : 'pass';

export const floorTo = (value: number, step: number): number => Math.floor(value / step + 1e-9) * step;
export const ceilTo = (value: number, step: number): number => Math.ceil(value / step - 1e-9) * step;

export const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

/** Factores de carga de NTC-CyA 2023 3.4.1 para combinaciones de acciones permanentes y variables. */
export const LOAD_FACTORS = Object.freeze({
  B: Object.freeze({ dead: 1.3, live: 1.5 }),
  A: Object.freeze({ dead: 1.5, live: 1.7 }),
  /** Acción cuyo efecto es favorable a la resistencia o a la estabilidad. */
  favorable: 0.9,
});
export type StructureGroup = 'A' | 'B';

/**
 * FR para momento o flexocompresión en elementos con estribos (NTC 2023 tabla
 * 3.8.2.2): 0.65 controlados por compresión, 0.90 controlados por tensión y
 * transición lineal 0.65 + 0.25(εt − εty)/0.003.
 */
export function resistanceFactorForStrain(netTensileStrain: number, yieldStrain: number): number {
  if (netTensileStrain <= yieldStrain) return 0.65;
  if (netTensileStrain >= yieldStrain + 0.003) return 0.9;
  return 0.65 + 0.25 * (netTensileStrain - yieldStrain) / 0.003;
}

/** FR de flexión en función de εt y εy; cada norma aporta el suyo (véase `codes.ts`). */
export type FlexureFactor = (netTensileStrain: number, yieldStrain: number) => number;

export interface FlexuralCapacity {
  readonly strengthKnm: number;
  readonly nominalKnm: number;
  readonly resistanceFactor: number;
  readonly netTensileStrain: number;
}

/**
 * Resistencia a flexión de una sección rectangular sin acero de compresión con
 * FR según la deformación del acero extremo (`extremeDepthMm`, dt). Sin norma
 * explícita se usa la tabla 3.8.2.2 de la NTC 2023 (motor v1 ligado al Modelo 2D).
 */
export function flexuralCapacity(
  areaMm2: number,
  widthMm: number,
  depthMm: number,
  fyMpa: number,
  fcMpa: number,
  extremeDepthMm = depthMm,
  factor: FlexureFactor = resistanceFactorForStrain,
): FlexuralCapacity {
  const fpp = equivalentBlockStrengthMpa(fcMpa);
  const q = areaMm2 / (widthMm * depthMm) * fyMpa / fpp;
  const nominalKnm = areaMm2 * fyMpa * depthMm * (1 - 0.5 * q) / 1e6;
  const blockDepth = areaMm2 * fyMpa / (fpp * widthMm);
  const neutralAxis = blockDepth / betaOne(fcMpa);
  const netTensileStrain = neutralAxis > 0 ? CONCRETE_ULTIMATE_STRAIN * (extremeDepthMm - neutralAxis) / neutralAxis : Number.POSITIVE_INFINITY;
  const resistanceFactor = factor(netTensileStrain, fyMpa / STEEL_ELASTIC_MODULUS_MPA);
  return { strengthKnm: resistanceFactor * nominalKnm, nominalKnm, resistanceFactor, netTensileStrain };
}

/**
 * Acero requerido para `momentKnm` con FR según εt. Hasta el límite controlado
 * por tensión (`tensionControlledStrain`; NTC: εty + 0.003) FR es constante y MR
 * crece con As, así que basta una bisección; en la zona de transición FR baja
 * al crecer As y MR puede no ser monótono, por eso ahí se recorre una malla fina
 * hasta el acero balanceado. Devuelve `undefined` si ninguna cuantía hasta la
 * balanceada alcanza.
 */
export function requiredFlexuralSteelMm2(
  momentKnm: number,
  widthMm: number,
  depthMm: number,
  fyMpa: number,
  fcMpa: number,
  extremeDepthMm = depthMm,
  factor: FlexureFactor = resistanceFactorForStrain,
  tensionControlledStrain: (yieldStrain: number) => number = (yieldStrain) => yieldStrain + 0.003,
): number | undefined {
  if (momentKnm <= 0) return 0;
  const fpp = equivalentBlockStrengthMpa(fcMpa);
  const beta = betaOne(fcMpa);
  const yieldStrain = fyMpa / STEEL_ELASTIC_MODULUS_MPA;
  const balanced = fpp / fyMpa * (600 * beta / (fyMpa + 600)) * widthMm * depthMm;
  const tensionControlledDepth = CONCRETE_ULTIMATE_STRAIN * extremeDepthMm / (CONCRETE_ULTIMATE_STRAIN + tensionControlledStrain(yieldStrain));
  const tensionControlled = Math.min(balanced, fpp * beta * tensionControlledDepth * widthMm / fyMpa);
  const strength = (area: number) => flexuralCapacity(area, widthMm, depthMm, fyMpa, fcMpa, extremeDepthMm, factor).strengthKnm;
  const bisect = (low: number, high: number) => {
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (low + high) / 2;
      if (strength(middle) >= momentKnm) high = middle; else low = middle;
    }
    return high;
  };
  if (strength(tensionControlled) >= momentKnm) return bisect(0, tensionControlled);
  const steps = 400;
  let previous = tensionControlled;
  for (let step = 1; step <= steps; step += 1) {
    const area = tensionControlled + (balanced - tensionControlled) * step / steps;
    if (strength(area) >= momentKnm) return bisect(previous, area);
    previous = area;
  }
  return undefined;
}
