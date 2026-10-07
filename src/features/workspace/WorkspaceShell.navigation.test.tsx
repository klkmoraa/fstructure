// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import App from '../../App';
import { createConcreteFrameProject, createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { WORKSPACE_LAYOUT_STORAGE_KEY } from './useWorkspaceLayoutPreferences';
import { emitWorkspaceCommand } from './workspaceCommands';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver, configurable: true });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/?surface=workspace2d');
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorCollapsed: false }));
});
// Los guardados del proyecto terminan en segundo plano: se espera a que acaben
// antes de que el entorno se desmonte (con la suite en paralelo llegan tarde).
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 250));
});

// Cada mesa se carga en diferido; la primera importación en frío (y con toda
// la suite en paralelo) tarda más que el segundo de espera por defecto.
const LAZY = { timeout: 8000 };
const TEST_TIMEOUT = 30_000;

it('los atajos del modo Modelo no existen en el modo Diseño', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('application', undefined, LAZY);
  // Control: en el Modelo 2D, Ctrl+K sí abre su paleta.
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(await screen.findByRole('listbox', { name: 'Paleta de comandos' })).toBeTruthy();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Paleta de comandos' })).toBeNull());
  await user.click(screen.getByRole('button', { name: /Cómo usar FStructure/ }));
  const close = screen.getByRole('button', { name: 'Cerrar guía' });
  await waitFor(() => expect(document.activeElement).toBe(close));
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(screen.queryByRole('listbox', { name: 'Paleta de comandos' })).toBeNull();
  expect(document.activeElement).toBe(close);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('[aria-modal="true"]')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Cómo usar FStructure/ })));

  await user.click(screen.getByRole('button', { name: 'Diseño' }));
  expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, LAZY)).toBeTruthy();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole('listbox', { name: 'Paleta de comandos' })).toBeNull();
  // La guía del modo Diseño es otra.
  expect(screen.getByRole('button', { name: /Cómo diseñar en FStructure/ })).toBeTruthy();
}, TEST_TIMEOUT);

it('cambiar de modo desmonta el anterior y la recarga vuelve al modo de la URL', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByRole('application', undefined, LAZY);
  const projectId = new URLSearchParams(window.location.search).get('project');

  await user.click(screen.getByRole('button', { name: 'Modelo 3D' }));
  expect(await screen.findByRole('button', { name: 'Modelo 3D', pressed: true }, LAZY)).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
  expect(new URLSearchParams(window.location.search).get('mode')).toBe('3d');
  expect(new URLSearchParams(window.location.search).get('project')).toBe(projectId);
  expect(screen.queryByRole('application', { name: /2D/ })).toBeNull();
  // La misma mesa: misma marca y mismo nombre de proyecto en la barra.
  expect(document.querySelector('[data-workspace-topbar]')?.getAttribute('data-tool')).toBe('model2d');

  await user.click(screen.getByRole('button', { name: 'Modelo 2D' }));
  expect(await screen.findByRole('application', undefined, LAZY)).toBeTruthy();
  expect(screen.getAllByRole('application')).toHaveLength(1);
  expect(document.querySelector('[data-workspace-mode="space3d"]')).toBeNull();

  view.unmount();
  render(<App />);
  expect(await screen.findByRole('application', undefined, LAZY)).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
}, TEST_TIMEOUT);

it('3D y Diseño comparten el mismo shell: la barra no se vuelve a montar al pasar de uno a otro', async () => {
  window.history.replaceState(null, '', '/?tool=model2d&mode=3d');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: 'Modelo 3D', pressed: true }, LAZY);
  const shell = document.querySelector('.app-shell');
  const bar = document.querySelector('[data-workspace-topbar]');
  const modes = bar?.querySelector('.workspace-topbar__mode-group');
  expect(bar).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Diseño' }));
  expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, LAZY)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Diseño', pressed: true })).toBeTruthy();
  expect(document.querySelector('.app-shell')).toBe(shell);
  expect(document.querySelector('[data-workspace-topbar]')).toBe(bar);
  expect(document.querySelector('.workspace-topbar__mode-group')).toBe(modes);
  // El pie de estado es el de Diseño y la mesa 3D ya no está.
  expect(screen.getByRole('contentinfo', { name: 'Estado de Diseño' })).toBeTruthy();
  expect(document.querySelector('.space3d-screen')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Modelo 3D' }));
  await screen.findByRole('button', { name: 'Modelo 3D', pressed: true }, LAZY);
  expect(document.querySelector('[data-workspace-topbar]')).toBe(bar);
  expect(screen.queryByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeNull();
}, TEST_TIMEOUT);

it('modelar y diseñar en la misma mesa: Diseño diseña el modelo, «Pasar al modelo» lo reemplaza y Deshacer lo recupera', async () => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createConcreteFrameProject()));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('application', undefined, LAZY);
  await user.click(screen.getByRole('button', { name: 'Diseño' }));
  // Se empieza por diseñar el modelo: Estructura con fuente Modelo 2D.
  expect(await screen.findByRole('heading', { name: 'Estructura' }, LAZY)).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
  expect(screen.getByRole('radio', { name: 'Modelo 2D' }).getAttribute('aria-checked')).toBe('true');
  expect(await screen.findByRole('img', { name: /Utilización de el Modelo 2D: 2 líneas de viga y 6 columnas/ }, LAZY)).toBeTruthy();
  expect(screen.queryByRole('application')).toBeNull();
  // Un pórtico rápido de un claro reemplaza el modelo tras confirmar.
  await user.click(screen.getByRole('radio', { name: 'Pórtico rápido' }));
  await user.click(screen.getByRole('button', { name: 'Quitar claro 2' }));
  await user.click(await screen.findByRole('button', { name: 'Pasar al modelo' }));
  await user.click(screen.getByRole('button', { name: 'Reemplazar el modelo' }));
  expect(screen.getByRole('radio', { name: 'Modelo 2D' }).getAttribute('aria-checked')).toBe('true');
  expect(await screen.findByRole('img', { name: /Utilización de el Modelo 2D: 2 líneas de viga y 4 columnas/ }, LAZY)).toBeTruthy();
  // «Editar en Modelo» vuelve al dibujo; ahí Deshacer devuelve el modelo anterior.
  await user.click(screen.getAllByRole('button', { name: 'Editar en Modelo' })[0]!);
  expect(await screen.findByRole('application', undefined, LAZY)).toBeTruthy();
  expect(new URLSearchParams(window.location.search).has('mode')).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Deshacer' }));
  await user.click(screen.getByRole('button', { name: 'Diseño' }));
  expect(await screen.findByRole('img', { name: /Utilización de el Modelo 2D: 2 líneas de viga y 6 columnas/ }, LAZY)).toBeTruthy();
}, TEST_TIMEOUT);

it('«Diseñar» desde el Inspector abre Diseño en el diseño de esa barra y «Ver en el Modelo» la deja seleccionada', async () => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createConcreteFrameProject()));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('application', undefined, LAZY);
  // Es lo que emite el botón «Diseñar» del Inspector con la barra C22 elegida.
  emitWorkspaceCommand('open-member-design', { memberId: 'C22' });
  const results = await screen.findByRole('region', { name: 'Resultados' }, LAZY);
  expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
  expect(await within(results).findByRole('heading', { name: /Columna del eje 2, nivel 2/ }, LAZY)).toBeTruthy();
  await user.click(within(results).getByRole('button', { name: /Ver en el Modelo/ }));
  await screen.findByRole('application', undefined, LAZY);
  expect(new URLSearchParams(window.location.search).get('mode')).toBeNull();
  // La barra vuelve seleccionada: el Inspector ofrece diseñarla otra vez.
  expect(await screen.findByRole('button', { name: 'Diseñar' }, LAZY)).toBeTruthy();
}, TEST_TIMEOUT);
