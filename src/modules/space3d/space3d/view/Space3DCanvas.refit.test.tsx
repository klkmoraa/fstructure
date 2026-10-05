// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Vector3, PerspectiveCamera, Scene } from 'three';
import { Space3DCanvas, type Space3DViewportFactory } from './Space3DCanvas';
import type { Space3DSceneModel } from './sceneModel';
import { SPACE3D_DEFAULT_LAYERS, type Space3DViewport } from './threeViewport';

afterEach(cleanup);

beforeAll(() => {
  // jsdom no trae ResizeObserver; el lienzo sólo lo usa para redimensionar.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const model = (offsetX: number): Space3DSceneModel => ({
  nodes: [], members: [], supports: [], loads: [], reactions: [],
  localAxes: null, deformed: null, diagnostics: [], isEmpty: true,
  bounds: { min: [offsetX, 0, 0], max: [offsetX + 1, 0, 0], center: [offsetX + 0.5, 0, 0], span: 1 },
});

/** Visor falso que registra el orden de las llamadas relevantes. */
const recordingFactory = (calls: string[]): Space3DViewportFactory => () => ({
  scene: new Scene(),
  camera: new PerspectiveCamera(),
  controlsTarget: new Vector3(),
  setModel: (next) => calls.push(`setModel:${next.bounds.center[0]}`),
  setLayers: () => undefined,
  setView: (preset) => calls.push(`setView:${preset}`),
  zoomBy: () => undefined,
  resize: () => undefined,
  render: () => undefined,
  requestRender: () => undefined,
  pickAt: () => null,
  dispose: () => undefined,
} satisfies Space3DViewport);

const copy = {
  label: 'Lienzo', fallbackTitle: '', fallbackBody: '', retry: '', summaryTitle: '',
  nodes: '', members: '', supports: '', loads: '',
};
const layers = SPACE3D_DEFAULT_LAYERS;

describe('Space3DCanvas · reencuadre', () => {
  it('does not refit on an ordinary model edit', () => {
    const calls: string[] = [];
    const factory = recordingFactory(calls);
    const { rerender } = render(<Space3DCanvas model={model(0)} layers={layers} copy={copy} createViewport={factory} refitToken={0} />);
    calls.length = 0;

    rerender(<Space3DCanvas model={model(500)} layers={layers} copy={copy} createViewport={factory} refitToken={0} />);
    expect(calls).toEqual(['setModel:500.5']);
  });

  it('refits once, after the new model, when the project is replaced', () => {
    const calls: string[] = [];
    const factory = recordingFactory(calls);
    const { rerender } = render(<Space3DCanvas model={model(0)} layers={layers} copy={copy} createViewport={factory} refitToken={0} />);
    calls.length = 0;

    // Sustitución: el modelo y el token cambian en el mismo commit.
    rerender(<Space3DCanvas model={model(500)} layers={layers} copy={copy} createViewport={factory} refitToken={1} />);
    // El orden importa: `setView` debe calcular sobre los límites nuevos.
    expect(calls).toEqual(['setModel:500.5', 'setView:isometric']);
  });
});
