import { REBAR_SIZES, STIRRUP_SIZES, barArea, rebarLabel } from '../elements/shared';
import type { ExerciseContext, ExerciseField, ExerciseOutcome, ExerciseSolution, ExerciseValues } from './types';
import { formatPlain, formatQuantity, type UnitSystem } from './units';
import type { DesignCodeId } from '../elements/codes';

export const ES = 200_000;
export const ECU = 0.003;

export { barArea, rebarLabel };

export const context = (code: DesignCodeId, units: UnitSystem): ExerciseContext => ({
  code,
  units,
  q: (value, kind) => formatQuantity(units, kind, value),
  n: (value, digits = 3) => formatPlain(value, digits),
});

/** Barra con su número: «#6 (19.1 mm)». */
export const barName = (diameterMm: number, usage: 'longitudinal' | 'transverse' = 'longitudinal') => {
  const label = rebarLabel(diameterMm, usage);
  return label.startsWith('#') ? `${label} (Ø ${formatPlain(diameterMm, 1)} mm)` : `Ø ${formatPlain(diameterMm, 1)} mm`;
};

export const barField = (id: string, symbol: string, label: string, usage: 'longitudinal' | 'transverse' = 'longitudinal'): ExerciseField => ({
  id, symbol, label, kind: 'diameter', bars: usage,
  options: (usage === 'transverse' ? STIRRUP_SIZES : REBAR_SIZES).map((size) => ({ value: size.diameterMm, label: `${size.label} · ${formatPlain(size.diameterMm, 1)} mm` })),
});

type Read = { ok: true; v: Record<string, number> } | { ok: false; outcome: ExerciseOutcome };

/** Lee los datos: faltantes primero, luego fuera de rango. */
export function read(fields: readonly ExerciseField[], values: ExerciseValues): Read {
  const missing = fields.filter((field) => !field.optional && !Number.isFinite(values[field.id])).map((field) => field.symbol);
  if (missing.length) return { ok: false, outcome: { status: 'missing', missing } };
  const v: Record<string, number> = {};
  for (const field of fields) {
    const value = values[field.id];
    if (!Number.isFinite(value)) continue;
    const number = value as number;
    if (field.positive && !(number > 0)) return { ok: false, outcome: { status: 'invalid', message: `${field.symbol} debe ser mayor que cero.` } };
    if (field.min !== undefined && number < field.min) return { ok: false, outcome: { status: 'invalid', message: `${field.symbol} es menor que el mínimo admitido.` } };
    if (field.integer && !Number.isInteger(number)) return { ok: false, outcome: { status: 'invalid', message: `${field.symbol} debe ser un número entero.` } };
    v[field.id] = number;
  }
  return { ok: true, v };
}

export const solved = (solution: ExerciseSolution): ExerciseOutcome => ({ status: 'solved', solution });
export const invalid = (message: string): ExerciseOutcome => ({ status: 'invalid', message });

export const ceilTo = (value: number, step: number) => Math.ceil(value / step - 1e-9) * step;
export const floorTo = (value: number, step: number) => Math.floor(value / step + 1e-9) * step;

/**
 * Propuestas de barras para un área: el menor exceso con 2 a 12 barras. Con
 * `fits`, primero las que caben en un lecho.
 */
export function barOptions(areaMm2: number, fits: (count: number, diameterMm: number) => boolean = () => true, diameters = [12.7, 15.9, 19.1, 22.2, 25.4, 28.6, 31.8]) {
  return diameters
    .map((diameterMm) => {
      const count = Math.max(2, Math.ceil(areaMm2 / barArea(diameterMm) - 1e-9));
      return { diameterMm, count, areaMm2: count * barArea(diameterMm), fits: fits(count, diameterMm) };
    })
    .filter((option) => option.count <= 12)
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.areaMm2 - b.areaMm2 || a.count - b.count)
    .slice(0, 3);
}

/** ¿Caben n barras en un lecho? Recubrimiento libre 40 mm, estribo #3 y separación libre mínima de la norma. */
export const fitsInWidth = (widthMm: number, clear: (diameterMm: number) => number) => (count: number, diameterMm: number) =>
  2 * (40 + 9.5) + count * diameterMm + (count - 1) * clear(diameterMm) <= widthMm + 1e-9;

/** Valores de ejemplo: el sistema interno es N·mm, así que kg/cm² y t se convierten aquí. */
export const KGCM2 = 0.0980665; // MPa
export const TON = 9.80665; // kN
