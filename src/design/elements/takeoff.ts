import type { BeamDesignResult } from './beam';
import type { ColumnDesignResult } from './column';
import type { CombinedFootingResult } from './combinedFooting';
import type { StripFootingResult } from './stripFooting';
import type { FootingDesignResult } from './footing';
import { barArea, rebarLabel } from './shared';

/**
 * Cuantificación aproximada de acero y concreto de un elemento diseñado. Sirve
 * para comparar alternativas y para la memoria; no sustituye la cuantificación
 * de planos de taller: longitudes rectas entre extremos, ganchos a 12db donde
 * el anclaje los pide, estribos con dos ganchos de 135° de max(6db, 75 mm) y
 * sin traslapes de las corridas ni desperdicio.
 */
export interface TakeoffLine {
  /** «Corridas superiores», «Estribos claro 1»… */
  readonly mark: string;
  readonly diameterMm: number;
  readonly count: number;
  /** Longitud de una pieza, m. */
  readonly pieceLengthM: number;
  readonly massKg: number;
}

export interface Takeoff {
  readonly lines: readonly TakeoffLine[];
  readonly steelKg: number;
  readonly concreteM3: number;
  /** kg de acero por m³ de concreto. */
  readonly steelRatioKgM3: number;
  readonly basis: string;
}

const STEEL_DENSITY_KG_M3 = 7_850;
/** Masa lineal de una varilla, kg/m. */
export const barMassKgPerM = (diameterMm: number) => barArea(diameterMm) * 1e-6 * STEEL_DENSITY_KG_M3;

const hook90Mm = (diameterMm: number) => 12 * diameterMm;
const hook135Mm = (diameterMm: number) => Math.max(6 * diameterMm, 75);

const line = (mark: string, diameterMm: number, count: number, pieceLengthM: number): TakeoffLine => ({
  mark,
  diameterMm,
  count,
  pieceLengthM,
  massKg: count * pieceLengthM * barMassKgPerM(diameterMm),
});

const BASIS = 'Aproximada: piezas rectas entre extremos, ganchos a 12db donde el anclaje los pide, estribos con ganchos de 135° y sin traslapes ni desperdicio.';

function summarize(lines: TakeoffLine[], concreteM3: number): Takeoff {
  const kept = lines.filter((item) => item.count > 0 && item.pieceLengthM > 0);
  const steelKg = kept.reduce((total, item) => total + item.massKg, 0);
  return { lines: kept, steelKg, concreteM3, steelRatioKgM3: concreteM3 > 0 ? steelKg / concreteM3 : 0, basis: BASIS };
}

/** Número de estribos en una longitud a una separación, contando el del arranque. */
const piecesAlong = (lengthMm: number, spacingMm: number) => lengthMm > 0 && spacingMm > 0 ? Math.ceil(lengthMm / spacingMm - 1e-9) : 0;

const stirrupLengthM = (widthMm: number, heightMm: number, coverMm: number, diameterMm: number) =>
  (2 * (widthMm - 2 * coverMm) + 2 * (heightMm - 2 * coverMm) + 2 * hook135Mm(diameterMm)) / 1e3;

export function beamTakeoff(result: BeamDesignResult): Takeoff {
  const { input } = result;
  const lengthMm = result.totalLengthM * 1e3;
  const hooksOn = (bed: 'top' | 'bottom') => result.anchorages.filter((item) => item.bed === bed && item.kind === 'hook').length;
  const continuous = (bed: 'top' | 'bottom') => {
    const section = bed === 'top' ? result.continuousTop : result.continuousBottom;
    const db = section.continuous.diameterMm;
    return line(`Corridas ${bed === 'top' ? 'superiores' : 'inferiores'} ${rebarLabel(db)}`, db, section.continuous.count, (lengthMm + hooksOn(bed) * hook90Mm(db)) / 1e3);
  };
  const bastions = result.bastions.map((bastion, index) => line(
    `Bastón ${bastion.bed === 'top' ? 'superior' : 'inferior'} ${index + 1} ${rebarLabel(bastion.bars.diameterMm)}`,
    bastion.bars.diameterMm,
    bastion.bars.count,
    (bastion.endM - bastion.startM) + (bastion.needsHook ? hook90Mm(bastion.bars.diameterMm) / 1e3 : 0),
  ));
  const ds = result.stirrupDiameterMm;
  const stirrups = result.spans.map((span, index) => {
    const zones = span.stirrups.denseZones;
    const denseMm = zones.reduce((total, zone) => total + (zone.endM - zone.startM) * 1e3, 0);
    const count = zones.length
      ? zones.reduce((total, zone) => total + piecesAlong((zone.endM - zone.startM) * 1e3, span.stirrups.denseSpacingMm), 0)
        + piecesAlong(span.lengthM * 1e3 - denseMm, span.stirrups.centerSpacingMm) + 1
      : piecesAlong(span.lengthM * 1e3, span.stirrups.denseSpacingMm) + 1;
    return line(`Estribos claro ${index + 1} ${rebarLabel(ds)}`, ds, count, stirrupLengthM(input.widthMm, input.heightMm, input.coverMm, ds));
  });
  return summarize([continuous('top'), continuous('bottom'), ...bastions, ...stirrups], input.widthMm * input.heightMm * lengthMm / 1e9);
}

export function columnTakeoff(result: ColumnDesignResult): Takeoff {
  const { input, ties } = result;
  const heightMm = input.unbracedLengthM * 1e3;
  const db = input.barDiameterMm;
  const dt = ties.diameterMm;
  const endZone = Math.min(ties.endLengthMm, heightMm / 2);
  const tieCount = endZone > 0
    ? 2 * piecesAlong(endZone, ties.endSpacingMm) + piecesAlong(heightMm - 2 * endZone, ties.centerSpacingMm) + 1
    : piecesAlong(heightMm, ties.centerSpacingMm) + 1;
  const crossTie = (spanMm: number) => (spanMm - 2 * input.coverMm + 2 * hook135Mm(dt)) / 1e3;
  const circular = input.shape === 'circular';
  // Estribo circular: perímetro de su eje más dos ganchos de 135°.
  const hoopLengthM = (Math.PI * (input.widthMm - 2 * input.coverMm - dt) + 2 * hook135Mm(dt)) / 1e3;
  return summarize([
    line(`Longitudinales ${rebarLabel(db)} (con traslape)`, db, result.bars.length, (heightMm + result.spliceLengthMm) / 1e3),
    line(`${circular ? 'Estribos circulares' : 'Estribos'} ${rebarLabel(dt)}`, dt, tieCount, circular ? hoopLengthM : stirrupLengthM(input.widthMm, input.depthMm, input.coverMm, dt)),
    line(`Grapas paralelas a X ${rebarLabel(dt)}`, dt, tieCount * ties.crossTiesParallelToX, crossTie(input.widthMm)),
    line(`Grapas paralelas a Y ${rebarLabel(dt)}`, dt, tieCount * ties.crossTiesParallelToY, crossTie(input.depthMm)),
  ], result.grossAreaMm2 * heightMm / 1e9);
}

export function footingTakeoff(result: FootingDesignResult): Takeoff {
  const { input } = result;
  const db = input.barDiameterMm;
  const piece = (sideMm: number, anchorage: 'straight' | 'hook' | 'insufficient') =>
    (sideMm - 2 * input.coverMm + (anchorage === 'hook' ? 2 * hook90Mm(db) : 0)) / 1e3;
  return summarize([
    line(`Parrilla en X ${rebarLabel(db)}`, db, result.directions.x.barCount, piece(result.sideXMm, result.directions.x.anchorage)),
    line(`Parrilla en Y ${rebarLabel(db)}`, db, result.directions.y.barCount, piece(result.sideYMm, result.directions.y.anchorage)),
  ], result.sideXMm * result.sideYMm * result.thicknessMm / 1e9);
}

/** Zapata corrida: cantidades por metro de muro. */
export function stripFootingTakeoff(result: StripFootingResult): Takeoff {
  const { input } = result;
  const db = input.barDiameterMm;
  const perMeter = Math.ceil(1_000 / result.transverse.spacingMm - 1e-9);
  const piece = (result.widthMm - 2 * input.coverMm + (result.transverse.anchorage === 'hook' ? 2 * hook90Mm(db) : 0)) / 1e3;
  return summarize([
    line(`Transversales ${rebarLabel(db)} (por metro)`, db, perMeter, piece),
    line(`Longitudinales ${rebarLabel(input.distributionBarDiameterMm)} (por metro)`, input.distributionBarDiameterMm, result.distribution.barCount, 1),
  ], result.widthMm * result.thicknessMm / 1e6);
}

export function combinedFootingTakeoff(result: CombinedFootingResult): Takeoff {
  const { input } = result;
  const long = (result.lengthMm - 2 * input.coverMm) / 1e3;
  const dt = input.transverseBarMm;
  const across = (anchorage: 'straight' | 'hook' | 'insufficient') => (result.widthMm - 2 * input.coverMm + (anchorage === 'hook' ? 2 * hook90Mm(dt) : 0)) / 1e3;
  const outside = Math.max(0, result.lengthMm - result.bands.reduce((total, band) => total + band.widthMm, 0));
  return summarize([
    line(`Longitudinal inferior ${rebarLabel(result.bottom.diameterMm)}`, result.bottom.diameterMm, result.bottom.barCount, long),
    ...(result.top ? [line(`Longitudinal superior ${rebarLabel(result.top.diameterMm)}`, result.top.diameterMm, result.top.barCount, long)] : []),
    ...result.bands.map((band) => line(`Transversal bajo C${band.column} ${rebarLabel(band.diameterMm)}`, band.diameterMm, band.barCount, across(band.anchorage))),
    line(`Transversal fuera de bandas ${rebarLabel(dt)}`, dt, Math.ceil(outside / result.transverseMinimumSpacingMm), across('straight')),
  ], result.lengthMm * result.widthMm * result.thicknessMm / 1e9);
}
