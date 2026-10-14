// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProposalGallery } from './ProposalGallery';

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/proposals.html'); });

test('un enlace abre columna y noche; editar la sección actualiza el dibujo sin escribir almacenamiento', () => {
  window.history.replaceState(null, '', '/proposals.html#view=column&theme=dark');
  const localWrite = vi.spyOn(Storage.prototype, 'setItem');
  render(<ProposalGallery />);
  expect(document.documentElement.dataset.theme).toBe('dark');
  const base = screen.getByRole('spinbutton', { name: 'Base' });
  fireEvent.change(base, { target: { value: '35' } });
  expect((base as HTMLInputElement).value).toBe('35');
  expect(screen.getAllByText(/35 cm/).length).toBeGreaterThan(0);
  fireEvent.change(base, { target: { value: '0' } });
  expect((screen.getByRole('button', { name: 'Proponer sección' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByText('Entre 15 y 120 cm para esta vista.').length).toBeGreaterThan(0);
  expect(localWrite).not.toHaveBeenCalled();
});

test('limpiar filtros recupera proyectos de muestra; la navegación conserva el tema del enlace', () => {
  window.history.replaceState(null, '', '/proposals.html#view=projects&theme=dark');
  render(<ProposalGallery />);
  const list = screen.getByTestId('proposal-project-list');
  expect(within(list).getByText('Ningún proyecto coincide con el filtro.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(within(list).getAllByRole('button')).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
  fireEvent.click(within(list).getByRole('button', { name: /Columna biaxial/ }));
  expect(window.location.hash).toContain('view=column');
  expect(window.location.hash).toContain('theme=dark');
  expect(screen.getByRole('spinbutton', { name: 'Base' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Ir a la pantalla' }));
  expect(document.activeElement?.id).toBe('proposal-preview');
  expect(window.location.hash).toContain('view=column');
});
