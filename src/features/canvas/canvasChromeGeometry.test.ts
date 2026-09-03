import { describe, expect, it } from 'vitest';
import { cameraToFitBounds, canvasSafeRect, expandBoundsForDecoration, LOAD_DECORATION_RESERVE_PX } from './canvasChromeGeometry';

describe('canvasChromeGeometry', () => {
  it('mantiene finita la cámara cuando los límites del modelo son corruptos', () => {
    const camera = cameraToFitBounds(
      { minX: Number.NaN, maxX: 6, minY: 0, maxY: 4 },
      { width: 390, height: 844 },
    );

    expect(Object.values(camera).every(Number.isFinite)).toBe(true);
  });

  it('deja sitio para lo que una carga dibuja fuera del nudo', () => {
    // El caso medido en un teléfono: un pórtico de 6x4 con una carga en el nudo
    // del borde. Con el encuadre de sólo nudos, la flecha —60px de asta en
    // espacio de pantalla— caía fuera del lienzo.
    const viewport = { width: 390, height: 844 };
    const bounds = { minX: 0, maxX: 6, minY: 0, maxY: 4 };
    const ajustado = cameraToFitBounds(bounds, viewport);
    const conReserva = cameraToFitBounds(expandBoundsForDecoration(bounds, ajustado.scale), viewport);

    const izquierdaDelNudo = (camera: { scale: number; x: number }) => camera.x + bounds.minX * camera.scale;
    expect(izquierdaDelNudo(ajustado)).toBeLessThan(LOAD_DECORATION_RESERVE_PX);
    expect(izquierdaDelNudo(conReserva)).toBeGreaterThanOrEqual(LOAD_DECORATION_RESERVE_PX);
    // La reserva acerca, nunca aleja de más: sigue siendo el mismo modelo.
    expect(conReserva.scale).toBeLessThan(ajustado.scale);
  });

  it('no inventa margen cuando la escala no es utilizable', () => {
    const bounds = { minX: 0, maxX: 6, minY: 0, maxY: 4 };
    expect(expandBoundsForDecoration(bounds, 0)).toEqual(bounds);
    expect(expandBoundsForDecoration(bounds, Number.NaN)).toEqual(bounds);
    expect(expandBoundsForDecoration(bounds, 40, 0)).toEqual(bounds);
  });

  it('mantiene finito el rectángulo seguro ante viewport e insets no finitos', () => {
    const safe = canvasSafeRect(
      { width: Number.NaN, height: Number.POSITIVE_INFINITY },
      { top: Number.NaN, right: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY, left: 8 },
    );

    expect(Object.values(safe).every(Number.isFinite)).toBe(true);
  });
});
