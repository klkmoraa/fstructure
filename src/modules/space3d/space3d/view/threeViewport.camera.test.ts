import { afterAll, beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Space3DSceneModel } from './sceneModel';
import { createSpace3DViewport, type Space3DControlsLike } from './threeViewport';

const model: Space3DSceneModel = {
  nodes: [
    { id: 'N1', position: [0, 0, 0], restrained: true, selected: false },
    { id: 'N2', position: [6, 3, 4], restrained: false, selected: false },
  ],
  members: [{ id: 'M1', nodeI: 'N1', nodeJ: 'N2', start: [0, 0, 0], end: [6, 3, 4], midpoint: [3, 1.5, 2], length: Math.hypot(6, 3, 4), basis: null, selected: false, result: null }],
  supports: [], loads: [], reactions: [], localAxes: null, deformed: null,
  bounds: { min: [0, 0, 0], max: [6, 3, 4], center: [3, 1.5, 2], span: 6 },
  diagnostics: [], isEmpty: false,
};

const rafGlobal = globalThis as typeof globalThis & { requestAnimationFrame?: (callback: FrameRequestCallback) => number; cancelAnimationFrame?: (handle: number) => void };
const originalRaf = rafGlobal.requestAnimationFrame;
const originalCancel = rafGlobal.cancelAnimationFrame;
beforeAll(() => {
  rafGlobal.requestAnimationFrame ??= (callback) => { callback(0); return 1; };
  rafGlobal.cancelAnimationFrame ??= () => undefined;
});
afterAll(() => { rafGlobal.requestAnimationFrame = originalRaf; rafGlobal.cancelAnimationFrame = originalCancel; });

const setup = () => {
  const size = { width: 800, height: 600 };
  const canvas = {
    get clientWidth() { return size.width; },
    get clientHeight() { return size.height; },
    parentElement: null,
    getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height, width: size.width, height: size.height, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
  const listeners = new Map<string, () => void>();
  const controls: Space3DControlsLike = {
    target: new Vector3(), enableDamping: false, update: () => undefined,
    addEventListener: (type, listener) => { listeners.set(type, listener); },
    removeEventListener: () => undefined, dispose: () => undefined,
  };
  const viewport = createSpace3DViewport({
    canvas, model,
    createRenderer: () => ({ setPixelRatio: () => undefined, setSize: () => undefined, render: () => undefined, dispose: () => undefined }),
    createControls: () => controls,
  });
  return { viewport, size, controls, orbit: () => listeners.get('start')?.() };
};

it('un redimensionado reencuadra mientras nadie movió la cámara, y la conserva después', () => {
  const { viewport, size, orbit } = setup();
  const fitted = viewport.camera.position.clone();
  viewport.camera.position.add(new Vector3(5, 0, 0));
  size.width = 1000;
  viewport.resize();
  // Sin interacción, el redimensionado vuelve al encuadre del preset.
  expect(viewport.camera.position.distanceTo(fitted)).toBeLessThan(1e-9);
  // La persona orbita: abrir un panel (otro ancho) ya no la devuelve al encuadre.
  orbit();
  viewport.camera.position.set(20, 8, -3);
  size.width = 700;
  viewport.resize();
  expect(viewport.camera.position.toArray()).toEqual([20, 8, -3]);
  expect((viewport.camera as { aspect: number }).aspect).toBeCloseTo(700 / 600, 12);
  // Un preset elegido vuelve a encuadrar.
  viewport.setView('isometric');
  expect(viewport.camera.position.distanceTo(new Vector3(20, 8, -3))).toBeGreaterThan(1);
  viewport.dispose();
});

it('devuelve una cámara guardada en otro visor (volver al modo 3D)', () => {
  const first = setup();
  first.viewport.setView('top');
  first.orbit();
  first.viewport.zoomBy(0.5);
  first.viewport.controlsTarget.set(1, 0, 2);
  const saved = first.viewport.getCameraState!();
  expect(saved.preset).toBe('top');
  expect(saved.zoom).toBeCloseTo(2, 12);
  first.viewport.dispose();

  const second = setup();
  second.viewport.setCameraState!(saved);
  const restored = second.viewport.getCameraState!();
  expect(restored.preset).toBe('top');
  expect(restored.zoom).toBeCloseTo(2, 12);
  expect(restored.target).toEqual(saved.target);
  for (let axis = 0; axis < 3; axis += 1) expect(restored.position[axis]).toBeCloseTo(saved.position[axis]!, 9);
  // Una cámara dañada (NaN) se ignora: queda el encuadre del preset.
  second.viewport.setCameraState!({ ...saved, position: [Number.NaN, 0, 0] });
  expect(Number.isFinite(second.viewport.camera.position.x)).toBe(true);
  second.viewport.dispose();
});
