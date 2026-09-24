// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import App from '../../App';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { WORKSPACE_LAYOUT_STORAGE_KEY } from './useWorkspaceLayoutPreferences';

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
afterEach(cleanup);

/**
 * Recorrido completo entre herramientas: logo → bienvenida de la herramienta
 * actual → FusionStructure → «Abrir <herramienta>» → su bienvenida →
 * «Continuar» → su mesa.
 */
const openFromHome = async (user: ReturnType<typeof userEvent.setup>, tool: string) => {
  await user.click(await screen.findByRole('button', { name: 'Ir al inicio' }));
  await user.click(await screen.findByRole('button', { name: 'Volver a FusionStructure' }));
  await screen.findByTestId('suite-welcome');
  await user.click(screen.getByRole('button', { name: new RegExp(`^Abrir ${tool} ·`) }));
  await user.click(await screen.findByRole('button', { name: tool === 'Elementos finitos' ? 'Abrir ejemplo' : 'Continuar' }));
};

it('abre FEM en su propia mesa: sin lienzo, consola ni utilidades del Modelo 2D', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('application', {}, { timeout: 10_000 }); // el primer render carga los chunks diferidos de App
  await openFromHome(user, 'Elementos finitos');

  expect(await screen.findByRole('heading', { name: 'Elementos finitos' })).toBeTruthy();
  const femAction = screen.getByRole('button', { name: 'Analizar FEM' });
  await user.click(femAction);
  expect((await screen.findByTestId('fem-analysis-result')).textContent).toContain('Análisis completado');

  expect(screen.queryByRole('application')).toBeNull();
  expect(document.querySelectorAll('[data-workspace-topbar]')).toHaveLength(1);
  expect(document.querySelector('[data-workspace-topbar]')?.getAttribute('data-tool')).toBe('fem');
  expect(screen.queryByRole('button', { name: 'Herramientas del espacio de trabajo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('fem');
});

it('los atajos del Modelo 2D no existen dentro de otra herramienta', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('application', {}, { timeout: 10_000 }); // el primer render carga los chunks diferidos de App
  // Control: en el Modelo 2D, Ctrl+K sí abre su paleta.
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(await screen.findByRole('listbox', { name: 'Paleta de comandos' })).toBeTruthy();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

  await openFromHome(user, 'Diseño');
  expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole('listbox', { name: 'Paleta de comandos' })).toBeNull();
});

it('cambiar de herramienta desmonta la anterior y la recarga vuelve a la herramienta de la URL', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByRole('application', {}, { timeout: 10_000 }); // el primer render carga los chunks diferidos de App
  const projectId = new URLSearchParams(window.location.search).get('project');

  await openFromHome(user, 'Solver 3D');
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('space3d');
  expect(new URLSearchParams(window.location.search).get('project')).toBe(projectId);
  expect(screen.queryByRole('application', { name: /2D/ })).toBeNull();

  await openFromHome(user, 'FStructure');
  expect(await screen.findByRole('application')).toBeTruthy();
  expect(screen.getAllByRole('application')).toHaveLength(1);
  expect(document.querySelector('[data-workspace-mode="space3d"]')).toBeNull();

  view.unmount();
  render(<App />);
  expect(await screen.findByRole('application')).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
});
