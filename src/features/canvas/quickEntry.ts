const DECIMAL_VALUE = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * Lee un número escrito con coma o punto decimal. Con el teclado completo del
 * teléfono es natural escribir la unidad detrás («3,5 m», «25kN»): si coincide
 * con la del campo, se acepta y se ignora. Cualquier otro texto no es un número.
 */
export const parseLocalizedDecimal = (raw: string, unit?: string): number | null => {
  let value = raw.trim();
  const suffix = unit?.trim().toLowerCase();
  if (suffix && value.toLowerCase().endsWith(suffix)) value = value.slice(0, -suffix.length).trim();
  if (!DECIMAL_VALUE.test(value)) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
