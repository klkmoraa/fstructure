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

it('guarda cada eje en la memoria con su rótulo para la memoria de cálculo y el PDF', async () => {
  const model = space3dFromModel2d(createConcreteFrameProject(), { frames: 2, spacingM: 5 }).model!;
  const axes = space3dDesignAxes(model);
  const onSaveAll = vi.fn(() => 'saved' as const);
  render(<BuildingAxes axes={axes} code="ntc-2023" draft={{ ...FRAME_DEFAULTS, source: 'model3d' }} current="z:0" onOpen={() => undefined} onClose={() => undefined} onSaveAll={onSaveAll} />);
  await userEvent.click(screen.getByRole('button', { name: `Guardar los ${axes.axes.length} ejes en la memoria` }));
  expect(onSaveAll).toHaveBeenCalledWith(axes.axes.map((axis) => ({ id: axis.id, tag: `Eje ${axis.short}` })));
  expect(screen.getByRole('status').textContent).toMatch(/memoria/i);
});

it('un eje guardado se recalcula en la memoria con el Modelo 3D vigente', async () => {
  const { reportFromMemoryItem } = await import('./designMemory');
  const { buildDesignMemoriaPdf } = await import('./designReportPdf');
  const model = space3dFromModel2d(createConcreteFrameProject(), { frames: 2, spacingM: 5 }).model!;
  const axes = space3dDesignAxes(model);
  const outcome = reportFromMemoryItem({
    id: 'e1', element: 'frame', code: 'ntc-2023', savedAt: '2026-10-03', fields: { ...FRAME_DEFAULTS, source: 'model3d', axis: 'z:5', tag: 'Eje 2' },
  }, null, axes);
  if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
  expect(outcome.report.tag).toBe('Eje 2');
  const bytes = await buildDesignMemoriaPdf([outcome.report], { figures: false });
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  // Sin el Modelo 3D, el eje no se inventa: la memoria dice por qué no se recalcula.
  expect(reportFromMemoryItem({ id: 'e1', element: 'frame', code: 'ntc-2023', savedAt: '2026-10-03', fields: { ...FRAME_DEFAULTS, source: 'model3d', axis: 'z:5' } }).ok).toBe(false);
}, 30_000);
