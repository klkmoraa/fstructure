// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createConcreteFrameProject } from '../../../data/defaultProject';
// Sólo la prueba arma el modelo con los puentes; la mesa recibe el contrato.
import { space3dFromModel2d } from '../../../integrations/model2dSpace3d';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import { BuildingAxes } from './BuildingAxes';
import { FRAME_DEFAULTS } from './frameModel';

afterEach(cleanup);

it('diseña todos los ejes uno por uno, dice cuál rige y abre el elegido', async () => {
  const model = space3dFromModel2d(createConcreteFrameProject(), { frames: 3, spacingM: 5 }).model!;
  const axes = space3dDesignAxes(model);
  const onOpen = vi.fn();
  render(<BuildingAxes axes={axes} code="ntc-2023" draft={{ ...FRAME_DEFAULTS, source: 'model3d' }} current="z:0" onOpen={onOpen} onClose={() => undefined} />);
  expect(screen.getByText(/Diseñando eje 1 de 6/)).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/^6 ejes · rige/)).toBeTruthy(), { timeout: 20_000 });
  const table = screen.getByRole('table', { name: /Ejes del Modelo 3D/ });
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(6);
  // Los pórticos (ejes 1–3) rigen sobre los transversales (A–C), que sólo llevan su peso.
  const ratioOf = (row: HTMLElement) => Number(within(row).getAllByRole('cell')[2]!.textContent!.replace(/\D/g, ''));
  expect(Math.min(...rows.slice(0, 3).map(ratioOf))).toBeGreaterThan(Math.max(...rows.slice(3).map(ratioOf)));
  // Las nueve columnas en planta tienen cociente (ninguna queda «pendiente»).
  expect(document.querySelectorAll('.dw-building-plan__column:not([data-band="pending"])')).toHaveLength(9);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir Eje B · x = 6 m' }));
  expect(onOpen).toHaveBeenCalledWith('x:6');
}, 30_000);
