// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import Space3DWorkspace from './Space3DWorkspace';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import { createBlankSpace3DProject } from '../../space3d/model/defaultProject';
import { freeSpace3DRestraints, type Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

/** El rayo del puntero corta el plano siempre en el mismo punto, sin ajustar. */
let planeHit: [number, number, number] = [1.2, 0, 2.7];
const fakeViewport: Space3DViewportFactory = () => ({
  scene: new Scene(), camera: new PerspectiveCamera(), controlsTarget: new Vector3(),
  setModel: () => undefined, setLayers: () => undefined, setView: () => undefined,
  zoomBy: () => undefined, resize: () => undefined, render: () => undefined,
  requestRender: () => undefined, pickAt: () => null, dispose: () => undefined,
  pickPlane: () => planeHit, setDraft: () => undefined,
});

const renderWorkspace = (project: Space3DProjectV1) => render(
  <Space3DWorkspace language="es" storage={null} createViewport={fakeViewport} canonicalProject={project} />,
);

const tapCanvas = () => {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
};

/** Una lista vacía no se dibuja: el grupo muestra su texto de «todavía no hay». */
const rows = (group: string) => {
  const list = screen.queryByRole('list', { name: group });
  return list ? within(list).queryAllByRole('button') : [];
};

describe('Space3DWorkspace · modelado directo', () => {
  it('places a node on the work plane, snapped to the grid', async () => {
    const user = userEvent.setup();
    planeHit = [1.2, 0, 2.7];
    renderWorkspace(createBlankSpace3DProject());

    await user.click(screen.getByRole('button', { name: 'Nuevo nudo' }));
    tapCanvas();

    expect(screen.getByText('Nudo N1 colocado en (1, 0, 3) m.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(rows('Nudos')).toHaveLength(1);
  });

  it('draws a member to an empty point, creating its end node', async () => {
    const user = userEvent.setup();
    const blank = createBlankSpace3DProject();
    renderWorkspace({ ...blank, nodes: [{ id: 'N1', x: 0, y: 0, z: 0, restraints: freeSpace3DRestraints() }] });

    await user.click(screen.getByRole('button', { name: 'Nueva barra' }));
    planeHit = [0, 0, 0];
    tapCanvas();
    expect(screen.getByText('La barra empieza en N1.')).toBeTruthy();
    // Vista isométrica: el plano es horizontal, así que la barra avanza en X.
    planeHit = [3.1, 0, 0];
    tapCanvas();

    expect(screen.getByText(/Barra M1 creada/)).toBeTruthy();
    expect(rows('Nudos')).toHaveLength(2);
    expect(rows('Barras')).toHaveLength(1);
  });

  it('supports the whole base in one step that a single undo reverts', async () => {
    const user = userEvent.setup();
    const frame = generateSpace3DFrame({ baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4 });
    renderWorkspace({ ...frame, nodes: frame.nodes.map((node) => ({ ...node, restraints: freeSpace3DRestraints() })) });
    expect(rows('Apoyos')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Nuevo apoyo' }));
    await user.click(screen.getByRole('button', { name: 'Apoyar la base (4)' }));
    expect(rows('Apoyos')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(rows('Apoyos')).toHaveLength(0);
  });

  it('refuses a load without a positive magnitude', async () => {
    const user = userEvent.setup();
    renderWorkspace(generateSpace3DFrame({ baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4 }));

    await user.click(screen.getByRole('button', { name: 'Nueva carga' }));
    const magnitude = screen.getByRole('textbox', { name: /Magnitud/ });
    await user.clear(magnitude);
    await user.type(magnitude, '0');
    expect(screen.getByRole('button', { name: /Cargar el nivel superior/ })).toHaveProperty('disabled', true);
  });
});
