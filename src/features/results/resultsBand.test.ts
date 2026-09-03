import { describe, expect, it } from 'vitest';
import { resultsBandPx } from './resultsBand';

describe('banda publicada por el panel de Resultados', () => {
  it('mide desde el borde inferior de la ventana hasta el techo del panel', () => {
    // El caso medido en escritorio: ventana de 900, panel desplegado con su
    // techo en 537. El riel flotante tiene que subir 363px, no quedarse en la
    // constante de 76 con la que caía dentro del panel.
    expect(resultsBandPx(900, 537)).toBe(363);
  });

  it('con el panel plegado la banda es pequeña, no cero', () => {
    expect(resultsBandPx(900, 844)).toBe(56);
  });

  it('un panel más alto que la ventana no manda el riel fuera por arriba', () => {
    expect(resultsBandPx(844, -200)).toBe(844);
  });

  it('una medida inservible no publica una banda absurda', () => {
    for (const [alto, techo] of [[Number.NaN, 500], [900, Number.NaN], [Number.POSITIVE_INFINITY, 0]] as const) {
      const band = resultsBandPx(alto, techo);
      expect(Number.isFinite(band) && band >= 0).toBe(true);
    }
  });
});
