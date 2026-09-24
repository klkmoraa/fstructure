// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import App from '../../App';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';

class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver, configurable: true });

// WebGL no existe en jsdom; el modelo, los comandos y el almacenamiento son reales.
vi.mock('../../modules/space3d/space3d/view/threeViewport', async (original) => ({
  ...await original<typeof import('../../modules/space3d/space3d/view/threeViewport')>(),
  createSpace3DViewport: () => { throw new Error('WebGL unavailable'); },
}));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const openHome = (tool: string) => window.history.replaceState(null, '', `/?surface=home&tool=${tool}`);

it('Solver 3D: «Generar una estructura» abre la mesa con el generador', async () => {
  const user = userEvent.setup();
  openHome('space3d');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /Generar una estructura/ }));
  expect(new URLSearchParams(window.location.search).get('surface')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('space3d');
  expect(await screen.findByRole('textbox', { name: 'Descripción de la estructura a generar' })).toBeTruthy();
});

it('Elementos finitos: «Analizar el caso de prueba» abre la mesa con el resultado', async () => {
  const user = userEvent.setup();
  openHome('fem');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /Analizar el caso de prueba/ }));
  expect((await screen.findByTestId('fem-analysis-result')).textContent).toContain('Análisis completado');
});

it('Diseño: la norma y el elemento elegidos en la bienvenida abren el taller', async () => {
  const user = userEvent.setup();
  openHome('design');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'NSR-10' }));
  await user.click(screen.getByRole('button', { name: /^Columna/ }));
  const dock = await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' });
  await waitFor(() => expect(within(dock).getByRole('radio', { name: 'Columna' }).getAttribute('aria-checked')).toBe('true'));
  expect((screen.getByRole('combobox', { name: 'Norma de diseño' }) as HTMLSelectElement).value).toBe('nsr-10');
});

it('el logo de una mesa vuelve a la bienvenida de su herramienta', async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/?tool=fem');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Ir al inicio' }));
  expect(await screen.findByTestId('fem-welcome')).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('fem');
});
