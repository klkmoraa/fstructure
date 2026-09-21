// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

const chooseSurface = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(await screen.findByRole('button', { name: 'Abrir navegación del proyecto' }));
  await user.click(screen.getByRole('menuitem', { name: label }));
};

it('preserves the mounted 2D canvas while opening contextual results and switches to honest FEM', async () => {
  const user = userEvent.setup();
  render(<App />);
  const canvas = await screen.findByRole('application');
  await user.click(screen.getByRole('button', { name: 'Resultados' }));
  expect(screen.getByRole('application')).toBe(canvas);
  await chooseSurface(user, 'FEM');
  expect(await screen.findByRole('heading', { name: 'Elementos finitos' })).toBeTruthy();
  const femAction = screen.getByRole('button', { name: 'Analizar FEM' });
  expect(femAction.hasAttribute('disabled')).toBe(false);
  await user.click(femAction);
  expect((await screen.findByTestId('fem-analysis-result')).textContent).toContain('Análisis completado');
  expect(screen.queryByRole('application')).toBeNull();
  expect(document.querySelectorAll('[data-workspace-topbar]')).toHaveLength(1);
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('fem');
});
afterEach(cleanup);

it('opens Design as a native tool from the compact surface menu', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: 'Abrir navegación del proyecto' });
  const topbar = document.querySelector('[data-workspace-topbar]');
  await chooseSurface(user, 'Diseño');
  expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
  expect(screen.queryByRole('application')).toBeNull();
  expect(document.querySelectorAll('[data-workspace-topbar]')).toHaveLength(1);
  expect(document.querySelector('[data-workspace-topbar]')).toBe(topbar);
});

it('switches native Design through canonical history and restores 2D canvas ownership on reload', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await chooseSurface(user, 'Diseño');
  expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
  const historyLength = window.history.length;
  const projectId = new URLSearchParams(window.location.search).get('project');

  await chooseSurface(user, '2D');
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
  expect(new URLSearchParams(window.location.search).get('project')).toBe(projectId);
  expect(window.history.length).toBe(historyLength + 1);
  expect(screen.queryByLabelText('Cerrar Diseño')).toBeNull();

  window.history.back();
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('tool')).toBe('design'));
  expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
  window.history.forward();
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d'));
  await waitFor(() => expect(screen.queryByLabelText('Cerrar Diseño')).toBeNull());

  view.unmount();
  render(<App />);
  expect(await screen.findByRole('application')).toBeTruthy();
  expect(screen.getAllByRole('application')).toHaveLength(1);
  expect(screen.queryByLabelText('Cerrar Diseño')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
});
