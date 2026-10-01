// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createTri3PatchFixture } from './public';
import { FemStudyView } from './FemStudyView';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('consulta una malla grande por páginas sin formatear todos sus nudos al abrir el modelo', async () => {
  const user = userEvent.setup();
  const base = createTri3PatchFixture();
  const document = { ...base, nodes: Array.from({ length: 1000 }, (_, index) => ({ id: `${index + 1}`, x: index / 10, y: 0 })) };
  const format = vi.spyOn(Number.prototype, 'toLocaleString');
  render(<FemStudyView document={document} analysis={null} onAnalyze={() => {}} />);
  expect(format.mock.calls.length).toBeLessThan(100);
  format.mockClear();
  await user.click(screen.getByRole('tab', { name: 'Malla' }));
  expect(format.mock.calls.length).toBeLessThan(150);
  await user.click(screen.getByText('Coordenadas de los nudos'));
  const nodes = screen.getByRole('table', { name: 'Nudos · m' });
  expect(within(nodes).getAllByRole('row')).toHaveLength(51);
  expect(within(nodes).queryByRole('cell', { name: '51' })).toBeNull();
  await user.click(within(screen.getByRole('navigation', { name: 'Páginas de Nudos · m' })).getByRole('button', { name: 'Siguiente' }));
  expect(within(nodes).getByRole('cell', { name: '51' })).toBeTruthy();
  expect(within(nodes).queryByRole('cell', { name: '1' })).toBeNull();
});
