import { describe, expect, it } from 'vitest';
import { cameraToFitBounds, canvasSafeRect } from './canvasChromeGeometry';

describe('canvasChromeGeometry', () => {
  it('mantiene finita la cámara cuando los límites del modelo son corruptos', () => {
    const camera = cameraToFitBounds(
      { minX: Number.NaN, maxX: 6, minY: 0, maxY: 4 },
      { width: 390, height: 844 },
    );

    expect(Object.values(camera).every(Number.isFinite)).toBe(true);
  });

  it('mantiene finito el rectángulo seguro ante viewport e insets no finitos', () => {
    const safe = canvasSafeRect(
      { width: Number.NaN, height: Number.POSITIVE_INFINITY },
      { top: Number.NaN, right: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY, left: 8 },
    );

    expect(Object.values(safe).every(Number.isFinite)).toBe(true);
  });
});
