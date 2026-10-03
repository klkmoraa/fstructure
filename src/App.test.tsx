// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbUnifiedBundleRepository } from './storage/unifiedBundleRepository';
import { createUnifiedProjectBundle } from './shared/project/unifiedProjectBundle';
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
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorCollapsed: false }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('standalone FStructure', () => {
  it('cada herramienta tiene su bienvenida entre el Inicio y su mesa', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?surface=welcome');
    render(<App />);
    for (const [tool, testId, heading] of [
      ['Solver 3D', 'space3d-welcome', 'Del nudo al espacio.'],
      ['Elementos finitos', 'fem-welcome', 'De la malla al campo.'],
      ['FStructure', 'solver2d-welcome', 'Del trazo al diagrama.'],
    ] as const) {
      await user.click(await screen.findByRole('button', { name: new RegExp(`^Abrir ${tool} ·`) }));
      expect(await screen.findByTestId(testId)).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get('surface')).toBe('home');
      await user.click(screen.getByRole('button', { name: 'Volver a FusionStructure' }));
      expect(await screen.findByTestId('suite-welcome')).toBeTruthy();
    }
  });

  it('abre la bienvenida y permite continuar al workspace', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByTestId('suite-welcome')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Make complexity legible.' })).toBeTruthy();
    // Tres mesas: FStructure (modelo y diseño), 3D y FEM.
    expect(screen.getByRole('navigation', { name: 'Herramientas' }).querySelectorAll('button')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^Abrir Diseño/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Continuar.*en FStructure/ }));

    expect(await screen.findByLabelText('Inspector')).toBeTruthy();
    expect(screen.getByLabelText('Panorama del modelo')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('project')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has('surface')).toBe(false);
  });

  it('una entrada directa al workspace vuelve a la bienvenida desde el logo', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?surface=workspace2d');
    render(<App />);

    expect(await screen.findByLabelText('Inspector')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));

    // El logo de la mesa lleva a la bienvenida original de FStructure…
    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Del trazo al diagrama.' })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('surface')).toBe('home');
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    // …y desde ella se vuelve al Inicio de FusionStructure.
    await user.click(screen.getByRole('button', { name: 'Volver a FusionStructure' }));
    expect(await screen.findByTestId('suite-welcome')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('surface')).toBe('welcome');
  });

  it('opens old Design links in the Design mode of FStructure and follows popstate back to welcome', async () => {
    const project = createDefaultProject();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    window.history.replaceState(null, '', `/?project=${project.id}&tool=design`);
    render(<App />);
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
    expect(screen.getByRole('button', { name: 'Diseño' }).getAttribute('aria-pressed')).toBe('true');
    act(() => {
      window.history.pushState(null, '', '/?surface=welcome');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByTestId('suite-welcome')).toBeTruthy();
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

  it('switches Modelo | Diseño in the same workbench with history and returns to FStructure’s welcome', async () => {
    window.history.replaceState(null, '', '/?surface=workspace2d');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('application');
    const before = window.history.length;
    await user.click(screen.getByRole('button', { name: 'Diseño' }));
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
    expect(window.history.length).toBe(before + 1);
    // La marca vuelve a la bienvenida de FStructure: Diseño no tiene otra.
    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));
    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
    window.history.back();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('mode')).toBe('design'));
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Modelo' }));
    expect(await screen.findByRole('application')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has('mode')).toBe(false);
  });

  it('opens an existing requested project and retains its identity and selected tool after reload', async () => {
    const project = { ...createDefaultProject(), id: 'project B / ñ', name: 'Proyecto B' };
    const repository = new IndexedDbUnifiedBundleRepository();
    await repository.saveBundle(createUnifiedProjectBundle(project, 'v1'), 0);
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

  it('preserves the requested project when switching tools during its repository lookup', async () => {
    const active = { ...createDefaultProject(), id: 'project-a' };
    const requested = { ...createDefaultProject(), id: 'project-b', name: 'Proyecto B' };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(active));
    const repository = new IndexedDbUnifiedBundleRepository();
    await repository.saveBundle(createUnifiedProjectBundle(requested, 'v1'), 0);
    const openProject = IndexedDbUnifiedBundleRepository.prototype.openBundle;
    let releaseLookup!: () => void;
    let lookupStarted!: () => void;
    const pending = new Promise<void>((resolve) => { releaseLookup = resolve; });
    const started = new Promise<void>((resolve) => { lookupStarted = resolve; });
    vi.spyOn(IndexedDbUnifiedBundleRepository.prototype, 'openBundle').mockImplementation(async function (this: IndexedDbUnifiedBundleRepository, id) {
      if (id === requested.id) {
        lookupStarted();
        await pending;
      }
      return openProject.call(this, id);
    });
    window.history.replaceState(null, '', '/?project=project-a&tool=model2d');
    render(<App />);
    await screen.findByRole('application');
    act(() => {
      window.history.pushState(null, '', '/?project=project-b&tool=model2d');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await started;
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: 'Diseño' }));
      expect(new URLSearchParams(window.location.search).get('project')).toBe('project-b');
      expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
      await act(async () => { releaseLookup(); });
      await waitFor(() => expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe('project-b'));
      expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' })).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get('project')).toBe('project-b');
      expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
    } finally {
      releaseLookup();
    }
  });
});
