// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
afterEach(cleanup);

describe('standalone FStructure', () => {
  it('abre la bienvenida y permite continuar al workspace', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Del trazo al diagrama.' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Inspector')).toBeTruthy();
    expect(screen.getByLabelText('Panorama del modelo')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('surface')).toBe('workspace2d');
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
});
