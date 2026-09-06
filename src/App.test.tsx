// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorCollapsed: false }));
});
afterEach(cleanup);

describe('standalone FStructure', () => {
  it('monta el inspector abierto con el proveedor de aula que necesita', () => {
    render(<App />);

    expect(screen.getByLabelText('Inspector')).toBeTruthy();
    expect(screen.getByLabelText('Panorama del modelo')).toBeTruthy();
  });
});
