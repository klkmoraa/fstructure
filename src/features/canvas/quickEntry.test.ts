import { describe, expect, it } from 'vitest';
import { parseLocalizedDecimal } from './quickEntry';

describe('número escrito con el teclado del teléfono', () => {
  it('acepta coma o punto decimal y la unidad del campo detrás', () => {
    expect(parseLocalizedDecimal('3,5')).toBe(3.5);
    expect(parseLocalizedDecimal(' -2.25 ')).toBe(-2.25);
    expect(parseLocalizedDecimal('3,5 m', 'm')).toBe(3.5);
    expect(parseLocalizedDecimal('25KN', 'kN')).toBe(25);
    expect(parseLocalizedDecimal('12 kN/m', 'kN/m')).toBe(12);
  });

  it('rechaza otra unidad o texto suelto', () => {
    expect(parseLocalizedDecimal('3,5 cm', 'm')).toBeNull();
    expect(parseLocalizedDecimal('tres')).toBeNull();
    expect(parseLocalizedDecimal('')).toBeNull();
  });
});
