export const parseNumber = (value: string): number => {
  const normalized = value.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
};

export const isShortString = (value: unknown): value is string => typeof value === 'string' && value.length <= 32;

/** Destinos de la tabla 6.1.2.2 de NTC-CyA 2023: W (media, para flechas diferidas) y Wm (máxima). */
export const LIVE_LOAD_USES = [
  { value: 'habitacion', label: 'Habitación', w: 0.8, wm: 1.9 },
  { value: 'oficinas', label: 'Oficinas', w: 1.0, wm: 2.5 },
  { value: 'aulas', label: 'Aulas', w: 1.0, wm: 2.5 },
  { value: 'comunicacion', label: 'Pasillos y escaleras', w: 0.4, wm: 3.5 },
] as const;
export const sustainedRatioFor = (use: string) => {
  const item = LIVE_LOAD_USES.find((entry) => entry.value === use) ?? LIVE_LOAD_USES[0];
  return item.w / item.wm;
};

/** ξ de la tabla 13.4.4.1 según la duración de la carga sostenida. */
export const LONG_TERM_DURATIONS = [
  { value: '3', label: '3 meses', xi: 1.0 },
  { value: '6', label: '6 meses', xi: 1.2 },
  { value: '12', label: '12 meses', xi: 1.4 },
  { value: '60', label: '5 años o más', xi: 2.0 },
] as const;
export const xiFor = (months: string) => (LONG_TERM_DURATIONS.find((entry) => entry.value === months) ?? LONG_TERM_DURATIONS[3]).xi;

const KGCM2_PER_MPA = 10.197_162;
export const mpaFromKgcm2 = (value: string) => parseNumber(value) / KGCM2_PER_MPA;
