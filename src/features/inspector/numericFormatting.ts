import { formatNumber, formatValue, serializeNumber } from '../../utils/numberFormat';

export interface InspectorNumberFormatOptions {
  maximumFractionDigits?: number;
  significantDigits?: number;
}

type InspectorNumberParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'non-finite' };

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

/**
 * Formats an Inspector value for reading. This is deliberately presentational:
 * it never feeds a rounded value back into project state. The rule itself lives in
 * `utils/numberFormat` so the Inspector, Results, the canvas and the PDF agree.
 */
export const formatInspectorNumber = (
  value: number,
  options: InspectorNumberFormatOptions = {},
): string => formatNumber(value, 'inspector', options);

export const formatInspectorValue = (
  value: number,
  unit = '',
  options: InspectorNumberFormatOptions = {},
): string => formatValue(value, unit, 'inspector', options);

/**
 * Returns JavaScript's shortest round-trip representation for editing. Unlike
 * the reading formatter, this function performs no precision reduction.
 */
export const serializeInspectorNumber = (value: number): string => serializeNumber(value);

/**
 * Accepts decimal/scientific input only; blank, hexadecimal and Infinity are rejected.
 * Con el teclado completo del teléfono se escribe «3,5» y a veces la unidad
 * («3,5 m»): la coma decimal se lee como punto y la unidad del campo se ignora.
 */
export const parseInspectorNumber = (text: string, unit?: string): InspectorNumberParseResult => {
  let normalized = text.trim();
  const suffix = unit?.trim().toLowerCase();
  if (suffix && normalized.toLowerCase().endsWith(suffix)) normalized = normalized.slice(0, -suffix.length).trim();
  if (!normalized.includes('.') && normalized.split(',').length === 2) normalized = normalized.replace(',', '.');
  if (normalized === '') return { ok: false, reason: 'empty' };
  if (!DECIMAL_NUMBER_PATTERN.test(normalized)) return { ok: false, reason: 'invalid' };

  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, reason: 'non-finite' };
  return { ok: true, value };
};
