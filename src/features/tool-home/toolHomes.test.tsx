// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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

it('la búsqueda anunciada por / recibe el foco sin interrumpir la escritura', async () => {
  const user = userEvent.setup();
  openHome('fem');
  render(<App />);
  await screen.findByTestId('fem-welcome');
  const search = screen.getByRole('searchbox', { name: 'Buscar' });
  await user.keyboard('/');
  expect(document.activeElement).toBe(search);
  await user.type(search, 'viga/');
  expect((search as HTMLInputElement).value).toBe('viga/');
  await user.keyboard('{Escape}');
  expect((search as HTMLInputElement).value).toBe('');
});

it('FStructure: «Modelar 3D» abre la misma mesa en modo 3D con su arranque', async () => {
  const user = userEvent.setup();
  openHome('model2d');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /Modelar 3D/ }));
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
  expect(new URLSearchParams(window.location.search).get('mode')).toBe('3d');
  // El modo 3D se carga de forma diferida (three.js incluido): en jsdom y en frío
  // tarda más del segundo por defecto de `findBy*`.
  await user.click(await screen.findByRole('button', { name: /Generar una estructura/ }, { timeout: 8000 }));
  expect(await screen.findByRole('textbox', { name: 'Descripción de la estructura a generar' }, { timeout: 8000 })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Modelo 3D' }).getAttribute('aria-pressed')).toBe('true');
}, 20_000);

it('Elementos finitos: «Analizar el caso de prueba» abre la mesa con el resultado', async () => {
  const user = userEvent.setup();
  openHome('fem');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /Analizar el caso de prueba/ }));
  expect((await screen.findByTestId('fem-analysis-result')).textContent).toContain('Análisis completado');
});

it('FStructure: «Diseñar un elemento» abre una viga independiente en la misma mesa', async () => {
  const user = userEvent.setup();
  openHome('model2d');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /Diseñar un elemento/ }));
  expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Viga' }).getAttribute('aria-checked')).toBe('true');
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
  expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
});

it('el logo de una mesa vuelve a la bienvenida de su herramienta', async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/?tool=fem');
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Ir al inicio' }));
  expect(await screen.findByTestId('fem-welcome')).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('fem');
});
