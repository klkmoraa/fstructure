import { describe, expect, it } from 'vitest';
import { cameraToCenterPoint, cameraToFitBounds, canvasSafeRect, expandBoundsForDecoration, LOAD_DECORATION_RESERVE_PX } from './canvasChromeGeometry';

describe('canvasChromeGeometry', () => {
  it('encuadra los apoyos por encima de la barra flotante de escritorio', () => {
    const viewport = { width: 1200, height: 616 };
    const bounds = { minX: 0, maxX: 6, minY: 0, maxY: 4 };
    const camera = cameraToFitBounds(bounds, viewport);
    const supportBottom = camera.y - bounds.minY * camera.scale + 24;
    // La barra comienza 116px antes del borde; el apoyo necesita 24px.
    expect(supportBottom).toBeLessThanOrEqual(viewport.height - 116);
  });

  it('localiza objetos en el centro del rectángulo libre de controles', () => {
    const viewport = { width: 1200, height: 616 };
    const point = { x: 6, y: 4 };
    const camera = cameraToCenterPoint(point, 85, viewport);
    const safe = canvasSafeRect(viewport);

    expect(camera.x + point.x * camera.scale).toBe(safe.x + safe.width / 2);
    expect(camera.y - point.y * camera.scale).toBe(safe.y + safe.height / 2);
  });

  it('centra el modelo en el canvas móvil cuando no hay una hoja abierta', () => {
    const viewport = { width: 390, height: 709 };
    const bounds = { minX: 0, maxX: 6, minY: 0, maxY: 4 };
    const camera = cameraToFitBounds(bounds, viewport);
    const modelCenter = {
      x: camera.x + ((bounds.minX + bounds.maxX) / 2) * camera.scale,
      y: camera.y - ((bounds.minY + bounds.maxY) / 2) * camera.scale,
    };

    expect(modelCenter.x).toBe(viewport.width / 2);
    expect(modelCenter.y).toBe(viewport.height / 2);
  });

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
