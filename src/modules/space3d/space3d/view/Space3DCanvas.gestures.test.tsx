// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { Space3DCanvas, type Space3DCanvasDraft, type Space3DViewportFactory } from './Space3DCanvas';
import type { Space3DSceneModel } from './sceneModel';
import { SPACE3D_DEFAULT_LAYERS } from './threeViewport';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const model: Space3DSceneModel = {
  nodes: [], members: [], supports: [], loads: [], reactions: [],
  localAxes: null, deformed: null, diagnostics: [], isEmpty: true,
  bounds: { min: [0, 0, 0], max: [1, 0, 0], center: [0.5, 0, 0], span: 1 },
};
const copy = { label: 'Lienzo', fallbackTitle: '', fallbackBody: '', retry: '', summaryTitle: '', nodes: '', members: '', supports: '', loads: '' };
const draft: Space3DCanvasDraft = { plane: { axis: 'y', offset: 0, step: 1 }, from: null, snap: (point) => point, describe: () => '' };

/** Sólo se sustituye WebGL; el arbitraje entre tocar y navegar es el real. */
const setup = (options: { drafting?: boolean; windowSelect?: boolean } = {}) => {
  const onSelect = vi.fn();
  const onDraftPick = vi.fn();
  const onWindowSelect = vi.fn();
  const setNavigationEnabled = vi.fn();
  const createViewport: Space3DViewportFactory = () => ({
    scene: new Scene(), camera: new PerspectiveCamera(), controlsTarget: new Vector3(),
    setModel: () => undefined, setLayers: () => undefined, setView: () => undefined,
    zoomBy: () => undefined, resize: () => undefined, render: () => undefined,
    requestRender: () => undefined, dispose: () => undefined,
    pickAt: () => ({ kind: 'member', id: 'M1' }),
    pickPlane: () => [2, 0, 3],
    pickRect: () => ({ nodes: [], members: ['M1'] }),
    setNavigationEnabled,
  });
  const { container } = render(<Space3DCanvas
    model={model} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={createViewport}
    onSelect={onSelect} onDraftPick={onDraftPick} onWindowSelect={onWindowSelect}
    windowSelect={options.windowSelect} draft={options.drafting ? draft : null}
  />);
  return { canvas: container.querySelector('canvas')!, onSelect, onDraftPick, onWindowSelect, setNavigationEnabled };
};

const touch = (pointerId: number, x = 40, y = 40) => ({ pointerType: 'touch', pointerId, button: 0, clientX: x, clientY: y });

describe('Space3DCanvas · tocar y navegar', () => {
  it('keeps a stationary touch available for selection', () => {
    const { canvas, onSelect } = setup();
    fireEvent.pointerDown(canvas, touch(1));
    fireEvent.pointerUp(canvas, touch(1));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'member', id: 'M1' }, { additive: false });
  });

  it('does not select when a camera drag returns to its starting point', () => {
    const { canvas, onSelect } = setup();
    fireEvent.pointerDown(canvas, touch(1));
    fireEvent.pointerMove(canvas, touch(1, 80));
    fireEvent.pointerUp(canvas, touch(1));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each([false, true])('does not pick at the end of a two-finger gesture (drawing: %s)', (drafting) => {
    const { canvas, onSelect, onDraftPick } = setup({ drafting });
    fireEvent.pointerDown(canvas, touch(1));
    fireEvent.pointerDown(canvas, touch(2, 80));
    fireEvent.pointerUp(canvas, touch(2, 80));
    fireEvent.pointerUp(canvas, touch(1));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDraftPick).not.toHaveBeenCalled();
    // El gesto terminó: el siguiente toque vuelve a funcionar.
    fireEvent.pointerDown(canvas, touch(3));
    fireEvent.pointerUp(canvas, touch(3));
    expect(drafting ? onDraftPick : onSelect).toHaveBeenCalledTimes(1);
  });

  it('pans a plan with touch while retaining mouse window selection', () => {
    const { canvas, onSelect, onWindowSelect, setNavigationEnabled } = setup({ windowSelect: true });
    fireEvent.pointerDown(canvas, touch(1));
    fireEvent.pointerMove(canvas, touch(1, 80));
    fireEvent.pointerUp(canvas, touch(1, 80));
    expect(setNavigationEnabled).not.toHaveBeenCalledWith(false);
    expect(onWindowSelect).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.pointerDown(canvas, { ...touch(2), pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...touch(2, 80), pointerType: 'mouse' });
    expect(onWindowSelect).toHaveBeenCalledWith({ nodes: [], members: ['M1'] }, { additive: false });
  });
});
