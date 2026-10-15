// @vitest-environment jsdom
/**
 * Resortes de apoyo y zonas rígidas desde el editor: se escriben en el
 * formulario, entran al historial (deshacer/rehacer), se analizan y se
 * reabren desde el almacenamiento local.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import Space3DWorkspace from './Space3DWorkspace';
import { createBlankSpace3DProject } from '../../space3d/model/defaultProject';
import { fixedSpace3DRestraints, freeSpace3DRestraints, type Space3DProjectV1 } from '../../space3d/model/types';
import { space3dStorageKeys, type Space3DStorageLike } from '../../space3d/data/storage';
import { parseSpace3DProject } from '../../space3d/data/codec';
import type { Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const fakeViewport: Space3DViewportFactory = () => ({
  scene: new Scene(), camera: new PerspectiveCamera(), controlsTarget: new Vector3(),
  setModel: () => undefined, setLayers: () => undefined, setView: () => undefined,
  zoomBy: () => undefined, resize: () => undefined, render: () => undefined,
  requestRender: () => undefined, pickAt: () => null, dispose: () => undefined,
  pickPlane: () => [0, 0, 0], setDraft: () => undefined,
});

const memoryStorage = (): Space3DStorageLike & { readonly data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
};

/** Voladizo de 4 m con la base libre de girar en Z: sin resorte es un mecanismo. */
const cantilever = (): Space3DProjectV1 => {
  const blank = createBlankSpace3DProject();
  return {
    ...blank,
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0, restraints: { ...fixedSpace3DRestraints(), rz: false } },
      { id: 'N2', x: 4, y: 0, z: 0, restraints: freeSpace3DRestraints() },
    ],
    members: [{
      id: 'M1', i: 'N1', j: 'N2', E: 200_000_000, G: 77_000_000, A: 0.01, Iy: 3e-5, Iz: 8e-5, J: 2e-5,
      orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
    }],
    nodalLoads: [{ id: 'P1', caseId: blank.loadCases[0].id, nodeId: 'N2', fx: 0, fy: -12, fz: 0, mx: 0, my: 0, mz: 0 }],
  };
};

const listButton = (group: string, name: string) => within(screen.getByRole('list', { name: group })).getByRole('button', { name: new RegExp(`^${name}(?![0-9])`) });

describe('Space3DWorkspace · resortes de apoyo y zonas rígidas', () => {
  it('edita un resorte, lo deshace y rehace, analiza y lo reabre', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const view = render(<Space3DWorkspace language="es" storage={storage} createViewport={fakeViewport} canonicalProject={cantilever()} />);

    await user.click(listButton('Nudos', 'N1'));
    await user.click(screen.getByText('Resortes de apoyo'));
    await user.type(screen.getByLabelText('kθZ'), '-5');
    await user.click(screen.getByRole('button', { name: 'Guardar nudo' }));
    expect(screen.getByRole('alert').textContent).toContain('mayor o igual que cero');

    await user.clear(screen.getByLabelText('kθZ'));
    await user.type(screen.getByLabelText('kθZ'), '8000');
    await user.click(screen.getByRole('button', { name: 'Guardar nudo' }));

    // Deshacer quita el resorte; rehacer lo devuelve.
    await user.click(screen.getAllByRole('button', { name: 'Deshacer' })[0]);
    await user.click(listButton('Nudos', 'N1'));
    expect((screen.getByLabelText('kθZ') as HTMLInputElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Volver al modelo' }));
    await user.click(screen.getAllByRole('button', { name: 'Rehacer' })[0]);
    await user.click(listButton('Nudos', 'N1'));
    expect((screen.getByLabelText('kθZ') as HTMLInputElement).value).toBe('8000');
    await user.click(screen.getByRole('button', { name: 'Volver al modelo' }));

    await user.click(screen.getAllByRole('button', { name: 'Analizar' })[0]);
    await user.click(await screen.findByRole('button', { name: /^Resultados/ }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Tablas detalladas' }), 'nodes');
    // La reacción del resorte cierra el momento de empotramiento P·L = 48 kN·m.
    const springRow = await screen.findByText('Reacción (con resorte)');
    expect(springRow.closest('tr')?.textContent).toMatch(/48/);

    await waitFor(() => {
      const saved = storage.data.get(space3dStorageKeys().primary);
      expect(saved && parseSpace3DProject(saved).nodes[0].springs).toEqual({ rz: 8000 });
    });
    view.unmount();

    render(<Space3DWorkspace language="es" storage={storage} createViewport={fakeViewport} />);
    await user.click(listButton('Nudos', 'N1'));
    expect((screen.getByLabelText('kθZ') as HTMLInputElement).value).toBe('8000');
  });

  it('muestra la longitud flexible y rechaza zonas rígidas que la agotan', async () => {
    const user = userEvent.setup();
    render(<Space3DWorkspace language="es" storage={null} createViewport={fakeViewport} canonicalProject={cantilever()} />);

    await user.click(listButton('Barras', 'M1'));
    await user.click(screen.getByText('Zonas rígidas'));
    await user.type(screen.getByLabelText('Zona rígida en i'), '0.5');
    expect(screen.getByText('Longitud flexible: 3.5 m de 4 m')).toBeTruthy();
    await user.type(screen.getByLabelText('Zona rígida en j'), '3.5');
    await user.click(screen.getByRole('button', { name: 'Guardar barra' }));
    expect(screen.getByRole('alert').textContent).toContain('parte flexible');

    await user.clear(screen.getByLabelText('Zona rígida en j'));
    await user.click(screen.getByRole('button', { name: 'Guardar barra' }));
    await user.click(listButton('Barras', 'M1'));
    expect((screen.getByLabelText('Zona rígida en i') as HTMLInputElement).value).toBe('0.5');
  });
});
