/**
 * Utilidades puras de los diálogos de «Definir»: separaciones de rejilla,
 * términos de combinación y espectros escritos como texto.
 */
import type { Space3DLoadCase, Space3DLoadCombinationTerm } from '../../space3d/model/types';

/**
 * «6 6 8», «6, 6, 8» o «3*6 8» → [6, 6, 6, 8]. Devuelve `null` si algo no es
 * un número positivo: una separación mal escrita no se ignora en silencio.
 */
export const parseSpace3DSpacings = (text: string): number[] | null => {
  const tokens = text.trim().split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const values: number[] = [];
  for (const token of tokens) {
    const repeat = /^(\d+)\s*[*x×]\s*(.+)$/i.exec(token);
    const count = repeat ? Number(repeat[1]) : 1;
    const value = Number((repeat ? repeat[2] : token).replace(',', '.'));
    if (!Number.isInteger(count) || count < 1 || count > 500 || !Number.isFinite(value) || value <= 0) return null;
    for (let index = 0; index < count; index += 1) values.push(value);
  }
  return values;
};

/** [6, 6, 6, 8] → «3*6 8». */
export const formatSpace3DSpacings = (values: readonly number[]): string => {
  const parts: string[] = [];
  for (let index = 0; index < values.length;) {
    let run = 1;
    while (index + run < values.length && values[index + run] === values[index]) run += 1;
    const value = Number(values[index].toPrecision(10)).toString();
    parts.push(run > 1 ? `${run}*${value}` : value);
    index += run;
  }
  return parts.join(' ');
};

/**
 * «1.2 DEAD + 1.6 LIVE − 0.5 SX» → términos. Los casos se buscan por id o
 * por nombre; un caso desconocido invalida todo.
 */
export const parseSpace3DCombinationTerms = (text: string, cases: readonly Space3DLoadCase[]): Space3DLoadCombinationTerm[] | null => {
  const normalized = text.replace(/[−–]/g, '-').trim();
  if (normalized === '') return null;
  const pattern = /([+-]?)\s*(\d*\.?\d+(?:e[+-]?\d+)?)?\s*\*?\s*([A-Za-z_][\w.-]*)/gi;
  const terms: Space3DLoadCombinationTerm[] = [];
  let consumed = '';
  for (const match of normalized.matchAll(pattern)) {
    consumed += match[0];
    const sign = match[1] === '-' ? -1 : 1;
    const factor = match[2] === undefined ? 1 : Number(match[2]);
    const name = match[3];
    const loadCase = cases.find((item) => item.id === name) ?? cases.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!loadCase || !Number.isFinite(factor)) return null;
    terms.push({ caseId: loadCase.id, factor: sign * factor });
  }
  // Todo lo escrito tiene que haberse leído: «1.2 DEAD + basura» no pasa.
  if (consumed.replace(/\s/g, '') !== normalized.replace(/\s/g, '')) return null;
  return terms.length > 0 ? terms : null;
};

export const formatSpace3DCombinationTerms = (terms: readonly Space3DLoadCombinationTerm[]): string => terms
  .map((term, index) => {
    const magnitude = Number(Math.abs(term.factor).toPrecision(6)).toString();
    const sign = term.factor < 0 ? '− ' : index === 0 ? '' : '+ ';
    return `${sign}${magnitude} ${term.caseId}`;
  })
  .join(' ');

/**
 * «0 0.16\n0.1 0.4 …» (un par periodo–Sa por línea) → puntos. `null` si un
 * valor no es un número no negativo o los periodos no crecen.
 */
export const parseSpace3DSpectrumPoints = (text: string): [number, number][] | null => {
  const lines = text.split(/\n|;/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const points: [number, number][] = [];
  for (const line of lines) {
    const values = line.split(/[\s,\t]+/).filter(Boolean).map((token) => Number(token));
    if (values.length !== 2 || !values.every((value) => Number.isFinite(value) && value >= 0)) return null;
    if (points.length > 0 && !(values[0] > points[points.length - 1][0])) return null;
    points.push([values[0], values[1]]);
  }
  return points;
};

export const formatSpace3DSpectrumPoints = (points: readonly (readonly [number, number])[]): string =>
  points.map(([period, acceleration]) => `${Number(period.toPrecision(6))} ${Number(acceleration.toPrecision(6))}`).join('\n');

interface Space3DPlateauSpectrumInput {
  /** Sa en T = 0, g. */
  readonly a0: number;
  /** Meseta, g. */
  readonly peak: number;
  /** Inicio y fin de la meseta, s. */
  readonly ta: number;
  readonly tb: number;
  /** Exponente de la caída Sa = peak·(tb/T)^r. */
  readonly exponent: number;
  readonly tMax?: number;
}

/** Espectro de meseta genérico, la forma común a las normas de la región. */
export const space3DPlateauSpectrum = ({ a0, peak, ta, tb, exponent, tMax = 4 }: Space3DPlateauSpectrumInput): [number, number][] | null => {
  if (![a0, peak, ta, tb, exponent, tMax].every((value) => Number.isFinite(value) && value >= 0) || !(tb > ta) || !(tMax > tb)) return null;
  const points: [number, number][] = [[0, a0]];
  if (ta > 0) points.push([ta, peak]);
  points.push([tb, peak]);
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    const period = tb + ((tMax - tb) * step) / steps;
    points.push([Number(period.toFixed(4)), Number((peak * (tb / period) ** exponent).toFixed(5))]);
  }
  return points;
};
