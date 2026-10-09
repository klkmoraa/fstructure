// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { HomePage } from './HomePage';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  window.history.replaceState({}, '', '?surface=welcome&view=classroom');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('HomePage Aula', () => {
  it('conserva el modelo vacío y abre Diseño en ejercicio propio', async () => {
    const user = userEvent.setup();
    const onOpenDesign = vi.fn();
    render(<ProjectProvider><HomePage onOpenWorkspace={vi.fn()} onOpenSpace3D={vi.fn()} onOpenDesign={onOpenDesign} /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /Ejercicio en blanco/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await user.keyboard('{Escape}');
    const button = screen.getByRole('button', { name: /Resolver sección y acero/ });
    await user.click(button);
    expect(onOpenDesign).toHaveBeenCalledWith('exercise');
    expect(screen.getAllByRole('button', { name: /Resolver sección y acero/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Viga simplemente apoyada/ })).toBeNull();
  });
});
