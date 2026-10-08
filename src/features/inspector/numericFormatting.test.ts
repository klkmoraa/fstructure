import { describe, expect, it } from 'vitest';
import { parseInspectorNumber } from './numericFormatting';

describe('número del inspector escrito con el teclado completo', () => {
  it('lee la coma decimal y admite la unidad del campo', () => {
    expect(parseInspectorNumber('-1,5')).toEqual({ ok: true, value: -1.5 });
    expect(parseInspectorNumber('2.5e-3')).toEqual({ ok: true, value: 0.0025 });
    expect(parseInspectorNumber('3,25 m', 'm')).toEqual({ ok: true, value: 3.25 });
    expect(parseInspectorNumber('200000 MPa', 'MPa')).toEqual({ ok: true, value: 200000 });
  });

  it('sigue rechazando lo ambiguo', () => {
    expect(parseInspectorNumber('1,000.5').ok).toBe(false);
    expect(parseInspectorNumber('1,2,3').ok).toBe(false);
    expect(parseInspectorNumber('3 cm', 'm').ok).toBe(false);
    expect(parseInspectorNumber('').ok).toBe(false);
  });
});
