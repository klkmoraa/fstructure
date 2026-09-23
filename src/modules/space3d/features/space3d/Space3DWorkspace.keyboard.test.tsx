// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import Space3DWorkspace from './Space3DWorkspace';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import type { Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

/** Sólo WebGL falta en jsdom: comandos, historial y teclado son los reales. */
const fakeViewport: Space3DViewportFactory = () => ({
  scene: new Scene(), camera: new PerspectiveCamera(), controlsTarget: new Vector3(),
  setModel: () => undefined, setLayers: () => undefined, setView: () => undefined,
  zoomBy: () => undefined, resize: () => undefined, render: () => undefined,
  requestRender: () => undefined, pickAt: () => null, dispose: () => undefined,
});

const renderWorkspace = () => render(
  <Space3DWorkspace
    language="es"
    storage={null}
    createViewport={fakeViewport}
    canonicalProject={generateSpace3DFrame({ baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4 })}
  />,
);

const memberButtons = () => within(screen.getByRole('table', { name: 'Barras' })).getAllByRole('button');

describe('Space3DWorkspace · atajos de teclado', () => {
  it('does not delete the selection when Backspace lands on a focused button', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const before = memberButtons().length;

    // Seleccionar desde la tabla deja el foco en el botón del identificador.
    const target = memberButtons()[0]!;
    await user.click(target);
    expect(document.activeElement).toBe(target);

    await user.keyboard('{Backspace}');
    expect(memberButtons()).toHaveLength(before);
  });

  it('still deletes the selection when focus is on the canvas', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const before = memberButtons().length;

    await user.click(memberButtons()[0]!);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    act(() => canvas.focus());
    expect(document.activeElement).toBe(canvas);

    await user.keyboard('{Delete}');
    expect(memberButtons()).toHaveLength(before - 1);
  });

  it('keeps the editor and its draft when Escape is pressed inside a field', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(within(screen.getByRole('table', { name: 'Nudos' })).getAllByRole('button')[0]!);
    const x = screen.getByLabelText('X') as HTMLInputElement;
    await user.clear(x);
    await user.type(x, '12.5');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /guardar nodo/i })).toBeTruthy();
    expect((screen.getByLabelText('X') as HTMLInputElement).value).toBe('12.5');
  });

  it('ignores an Escape another widget already handled', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(within(screen.getByRole('table', { name: 'Nudos' })).getAllByRole('button')[0]!);
    expect(screen.getByRole('button', { name: /guardar nodo/i })).toBeTruthy();

    // Un desplegable o la paleta de comandos consume Escape antes que la superficie.
    const consume = (event: Event) => event.preventDefault();
    document.body.addEventListener('keydown', consume);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    document.body.removeEventListener('keydown', consume);

    expect(screen.getByRole('button', { name: /guardar nodo/i })).toBeTruthy();
  });
});

// `sheetExpanded` es estado de la hoja móvil, pero "Editar" lo activa en todos
// los tamaños. Antes desmontaba HUD y leyenda también en escritorio, donde la
// hoja es una columna propia y no tapa nada. Ahora se quedan montados y es el
// CSS quien los retira, sólo bajo 960 px.
describe('Space3DWorkspace · HUD al abrir el editor', () => {
  it('keeps the selection HUD mounted after opening the editor from it', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(memberButtons()[0]!);

    const hud = () => document.querySelector('.space3d-hud-card');
    expect(hud()).not.toBeNull();
    await user.click(within(hud() as HTMLElement).getByRole('button', { name: /editar/i }));

    expect(hud()).not.toBeNull();
    expect(document.querySelector('.space3d-bottom-stack')?.hasAttribute('data-sheet-expanded')).toBe(true);
  });
});
