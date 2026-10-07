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
  it('la Home es la única portada: Continuar abre la mesa y no hay FEM', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByTestId('home')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Modela, analiza y diseña estructuras.' })).toBeTruthy();
    expect(screen.queryByText(/Elementos finitos/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByLabelText('Inspector')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('project')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has('surface')).toBe(false);
  });

  it('las secciones de la Home viven en la URL y vuelven al inicio', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('home');
    await user.click(screen.getByRole('button', { name: /Ver todos/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Proyectos' })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('view')).toBe('projects');
    await user.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Modela, analiza y diseña estructuras.' })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has('view')).toBe(false);
  });

  it('la tarjeta Diseño de la Home abre el modo Diseño de la mesa', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('home');
    await user.click(screen.getByRole('button', { name: /^Diseño/ }));
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, { timeout: 8000 })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
  });

  it('una entrada directa a la mesa vuelve a la Home desde el logo', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?surface=workspace2d');
    render(<App />);

    expect(await screen.findByLabelText('Inspector')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));

    expect(await screen.findByTestId('home')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('surface')).toBe('welcome');
  });

  it('opens old Design links in the Design mode of FStructure and follows popstate back to welcome', async () => {
    const project = createDefaultProject();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    window.history.replaceState(null, '', `/?project=${project.id}&tool=design`);
    render(<App />);
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, { timeout: 8000 })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
    expect(screen.getByRole('button', { name: 'Diseño' }).getAttribute('aria-pressed')).toBe('true');
    act(() => {
      window.history.pushState(null, '', '/?surface=welcome');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByTestId('home')).toBeTruthy();
  });

  it('sends retired FEM links to the Home and resolves a missing project to the actual model', async () => {
    const project = createDefaultProject();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    window.history.replaceState(null, '', '/?project=missing-project&surface=fem');
    render(<App />);
    expect(await screen.findByTestId('home')).toBeTruthy();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('surface')).toBe('welcome'));
    expect(new URLSearchParams(window.location.search).has('tool')).toBe(false);
    expect((await screen.findAllByText(project.name)).length).toBeGreaterThan(0);
  });

  it('switches Modelo | Diseño in the same workbench with history and returns to the Home', async () => {
    window.history.replaceState(null, '', '/?surface=workspace2d');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('application');
    const before = window.history.length;
    await user.click(screen.getByRole('button', { name: 'Diseño' }));
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, { timeout: 8000 })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('model2d');
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
    expect(window.history.length).toBe(before + 1);
    // La marca vuelve a la Home.
    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));
    expect(await screen.findByTestId('home')).toBeTruthy();
    window.history.back();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('mode')).toBe('design'));
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, { timeout: 8000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Modelo 2D' }));
    expect(await screen.findByRole('application')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has('mode')).toBe(false);
  });

  it('opens an existing requested project and retains its identity and selected tool after reload', async () => {
    const project = { ...createDefaultProject(), id: 'project B / ñ', name: 'Proyecto B' };
    const repository = new IndexedDbUnifiedBundleRepository();
    await repository.saveBundle(createUnifiedProjectBundle(project, 'v1'), 0);
    window.history.replaceState(null, '', `/?project=${encodeURIComponent(project.id)}&tool=model2d&mode=design`);
    const view = render(<App />);
    await waitFor(() => expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe(project.id));
    expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, { timeout: 8000 })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('project')).toBe(project.id);
    view.unmount();
    render(<App />);
    await waitFor(() => expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe(project.id));
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
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
      expect(await screen.findByRole('radiogroup', { name: 'Elemento a diseñar' }, { timeout: 8000 })).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get('project')).toBe('project-b');
      expect(new URLSearchParams(window.location.search).get('mode')).toBe('design');
    } finally {
      releaseLookup();
    }
  });
});
