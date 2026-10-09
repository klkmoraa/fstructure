import type { BeamExtraLoad, ProvidedBastion, ProvidedStirrupZone } from '../../../design/elements/beam';
import type { BeamDetailDraft } from './beamDetailDraft';
import type { SpanDraft } from './beamModel';
import { parseNumber } from './formNumbers';

export interface ParsedBeamDetails {
  readonly loads: readonly BeamExtraLoad[];
  readonly bastions: readonly ProvidedBastion[];
  readonly stirrupZones: readonly (ProvidedStirrupZone | null)[];
  readonly errors: readonly string[];
}

const number = (value: string) => value.trim() === '' ? Number.NaN : parseNumber(value);

/** Convierte sólo regiones completas y físicamente dentro de sus claros; el borrador original nunca se normaliza. */
export function parseBeamDetails(draft: BeamDetailDraft, spans: readonly SpanDraft[]): ParsedBeamDetails {
  const errors: string[] = [];
  const lengths = spans.map((span) => number(span.length));
  const validLengths = lengths.every((length) => Number.isFinite(length) && length > 0);
  const totalLength = validLengths ? lengths.reduce((sum, length) => sum + length, 0) : Number.NaN;
  const loads: BeamExtraLoad[] = [];
  draft.loads.forEach((row, index) => {
    const spanIndex = number(row.span) - 1;
    const span = lengths[spanIndex];
    const startM = number(row.start);
    const endM = row.kind === 'point' ? startM : number(row.end);
    const startKn = number(row.startValue);
    const endKn = row.kind === 'point' ? startKn : number(row.endValue);
    const positionValid = Number.isInteger(spanIndex) && spanIndex >= 0 && span !== undefined && Number.isFinite(span)
      && Number.isFinite(startM) && startM >= 0 && startM <= span
      && (row.kind === 'point' || (Number.isFinite(endM) && endM > startM && endM <= span));
    if (!positionValid || !Number.isFinite(startKn) || !Number.isFinite(endKn)) {
      errors.push(`Carga adicional ${index + 1}: completa magnitud y posiciones dentro del claro indicado.`);
      return;
    }
    loads.push({ spanIndex, category: row.category, kind: row.kind, startM, endM, startKn, endKn });
  });

  const bastions: ProvidedBastion[] = [];
  draft.bastions.forEach((row, index) => {
    const count = number(row.count);
    const diameterMm = number(row.diameterMm);
    const startM = number(row.startM);
    const endM = number(row.endM);
    if (!Number.isInteger(count) || count < 1 || count > 12 || !Number.isFinite(diameterMm) || diameterMm <= 0
      || !Number.isFinite(startM) || !Number.isFinite(endM) || startM < 0 || endM <= startM || endM > totalLength) {
      errors.push(`Bastón ${index + 1}: completa cantidad, diámetro y tramo dentro de la longitud total de la viga.`);
      return;
    }
    bastions.push({ bed: row.bed, count, diameterMm, startM, endM });
  });
  for (const bed of ['top', 'bottom'] as const) {
    const sameBed = bastions.filter((bastion) => bastion.bed === bed).sort((left, right) => left.startM - right.startM);
    if (sameBed.some((bastion, index) => index > 0 && bastion.startM < sameBed[index - 1]!.endM - 1e-9)) {
      errors.push(`Bastones ${bed === 'top' ? 'superiores' : 'inferiores'} traslapados: separa o combina las regiones.`);
      // Do not pass any custom geometry to the solver while the raw set overlaps.
      bastions.splice(0, bastions.length, ...bastions.filter((bastion) => bastion.bed !== bed));
    }
  }

  const stirrupZones: (ProvidedStirrupZone | null)[] = Array.from({ length: spans.length }, () => null);
  const seenZones = new Set<number>();
  draft.stirrupZones.forEach((row, index) => {
    const spanIndex = number(row.span) - 1;
    const length = lengths[spanIndex];
    const endSpacingMm = number(row.endSpacingMm);
    const endLengthM = number(row.endLengthM);
    const centerSpacingMm = number(row.centerSpacingMm);
    if (!Number.isInteger(spanIndex) || spanIndex < 0 || length === undefined || !Number.isFinite(length)
      || !Number.isFinite(endSpacingMm) || endSpacingMm < 50 || !Number.isFinite(centerSpacingMm) || centerSpacingMm < 50
      || !Number.isFinite(endLengthM) || endLengthM < 0 || 2 * endLengthM > length + 1e-9 || seenZones.has(spanIndex)) {
      errors.push(`Estribos del renglón ${index + 1}: indica un claro existente, separaciones ≥ 50 mm, longitud ≤ la mitad del claro y una sola zona por claro.`);
      return;
    }
    seenZones.add(spanIndex);
    stirrupZones[spanIndex] = { endSpacingMm, endLengthM, centerSpacingMm };
  });

  return { loads, bastions, stirrupZones, errors };
}
