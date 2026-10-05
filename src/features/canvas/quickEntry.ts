const DECIMAL_VALUE = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

export const parseLocalizedDecimal = (raw: string): number | null => {
  const value = raw.trim();
  if (!DECIMAL_VALUE.test(value)) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
