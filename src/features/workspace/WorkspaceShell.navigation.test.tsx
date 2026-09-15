// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
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
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/?surface=workspace2d');
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorCollapsed: false }));
});
afterEach(cleanup);

it('closes Design through the canonical route when entering full canvas and preserves history/reload behavior', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: 'Diseño' }));
  expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
  const historyLength = window.history.length;
  const projectId = new URLSearchParams(window.location.search).get('project');

  await user.click(screen.getByRole('button', { name: 'Mesa de trabajo completa' }));
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
  expect(screen.getByRole('button', { name: 'Salir de mesa completa' })).toBeTruthy();
  expect(screen.queryByLabelText('Cerrar Diseño')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
});
