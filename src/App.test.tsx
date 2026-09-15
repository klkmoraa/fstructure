// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as projectStorage from './storage/projectRepository';
import { createDefaultProject } from './data/defaultProject';
import { PROJECT_STORAGE_KEY } from './data/projectStorage';
import { WORKSPACE_LAYOUT_STORAGE_KEY } from './features/workspace/useWorkspaceLayoutPreferences';
import App from './App';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver, configurable: true });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorCollapsed: false }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('standalone FStructure', () => {
  it('abre la bienvenida y permite continuar al workspace', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Del trazo al diagrama.' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Inspector')).toBeTruthy();
    expect(screen.getByLabelText('Panorama del modelo')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('project')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has('surface')).toBe(false);
  });

  it('una entrada directa al workspace vuelve a la bienvenida desde el logo', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?surface=workspace2d');
    render(<App />);

    expect(screen.getByLabelText('Inspector')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));

    expect(screen.getByTestId('solver2d-welcome')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('surface')).toBe('welcome');
  });

  it('restores Design from its canonical URL and follows popstate back to welcome', async () => {
    const project = createDefaultProject();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    window.history.replaceState(null, '', `/?project=${project.id}&tool=design`);
    render(<App />);
    expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
    act(() => {
      window.history.pushState(null, '', '/?surface=welcome');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
  });

  it('migrates FEM and resolves a missing project to the actual model without losing the tool', async () => {
    const project = createDefaultProject();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    window.history.replaceState(null, '', '/?project=missing-project&surface=fem');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Elementos finitos' })).toBeTruthy();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('project')).toBe(project.id));
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('fem');
  });

  it('pushes Design open/close actions and restores the surface when moving back', async () => {
    window.history.replaceState(null, '', '/?surface=workspace2d');
    const user = userEvent.setup();
    render(<App />);
    const length = window.history.length;
    await user.click(screen.getByRole('button', { name: 'Diseño' }));
    expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('design');
    expect(window.history.length).toBe(length + 1);
    await user.click(screen.getByLabelText('Cerrar Diseño'));
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    window.history.back();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('tool')).toBe('design'));
    expect(await screen.findByLabelText('Cerrar Diseño')).toBeTruthy();
  });

  it('opens an existing requested project and retains its identity and selected tool after reload', async () => {
    const project = { ...createDefaultProject(), id: 'project B / ñ', name: 'Proyecto B' };
    const repository = new projectStorage.InMemoryProjectRepository();
    await repository.saveProject(project);
    // Only replace the unavailable browser database boundary with the real memory repository.
    vi.spyOn(projectStorage, 'getProjectRepository').mockReturnValue(repository);
    window.history.replaceState(null, '', `/?project=${encodeURIComponent(project.id)}&tool=fem`);
    const view = render(<App />);
    await waitFor(() => expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe(project.id));
    expect(await screen.findByRole('heading', { name: 'Elementos finitos' })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('project')).toBe(project.id);
    view.unmount();
    render(<App />);
    await waitFor(() => expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe(project.id));
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('fem');
  });
});
