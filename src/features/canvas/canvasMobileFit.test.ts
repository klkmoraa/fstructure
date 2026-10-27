import { describe, expect, it } from 'vitest';
import { cameraToFitBounds, canvasSafeRect, expandBoundsForDecoration } from './canvasChromeGeometry';
import { zoomCameraAt, screenToModelPoint, cameraForPinch } from './canvasInteraction';

describe('encuadre de modelos largos en móvil', () => {
  it.each([13, 60, 1000])('los extremos de una viga de %s m caben a 320 px', length => {
    const viewport = { width: 320, height: 716 };
    const bounds = { minX: 0, maxX: length, minY: 0, maxY: 0 };
    const first = cameraToFitBounds(bounds, viewport);
    const camera = cameraToFitBounds(expandBoundsForDecoration(bounds, first.scale), viewport);
    const safe = canvasSafeRect(viewport);
    expect(camera.x).toBeGreaterThanOrEqual(safe.x - 1e-8);
    expect(camera.x + length * camera.scale).toBeLessThanOrEqual(safe.x + safe.width + 1e-8);
    expect(camera.x).toBeGreaterThanOrEqual(66);
    expect(camera.x + length * camera.scale).toBeLessThanOrEqual(viewport.width - 66);
  });
  it('encuadra un pórtico alto en horizontal sin cortar la base', () => {
    const viewport = { width: 844, height: 232 };
    const camera = cameraToFitBounds({minX:0,maxX:20,minY:0,maxY:30},viewport);
    const safe = canvasSafeRect(viewport);
    expect(camera.y).toBeLessThanOrEqual(safe.y + safe.height);
    expect(camera.y-30*camera.scale).toBeGreaterThanOrEqual(safe.y-1e-8);
  });
  it('alejar una cámara ajustada por debajo de 15 px/m no acerca ni mueve el ancla', () => {
    const camera = {scale:4,x:160,y:250}; const anchor={x:82,y:125};
    const point=screenToModelPoint(anchor,camera);
    const next=zoomCameraAt(camera,anchor,0.8);
    expect(next.scale).toBeCloseTo(3.2);
    expect(screenToModelPoint(anchor,next)).toEqual(point);
  });
  it('acercar desde un encuadre lejano es progresivo, no salta a la escala mínima anterior', () => {
    expect(zoomCameraAt({scale:2,x:160,y:200},{x:160,y:200},1.2).scale).toBeCloseTo(2.4);
  });
});
it('el pellizco mantiene el punto bajo los dedos después de un encuadre lejano', () => {
  const start = {scale:4,x:160,y:250}; const anchor={x:100,y:200};
  const point=screenToModelPoint(anchor,start);
  const next=cameraForPinch(start,point,100,80,anchor);
  expect(next.scale).toBeCloseTo(3.2);
  expect(screenToModelPoint(anchor,next)).toEqual(point);
});
