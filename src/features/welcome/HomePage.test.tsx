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
  it('conserva el modelo vacío y lleva los ejercicios de diseño a Cálculo', async () => {
    const user = userEvent.setup();
    const onOpenDesign = vi.fn();
    const onOpenCalc = vi.fn();
    render(<ProjectProvider><HomePage onOpenWorkspace={vi.fn()} onOpenSpace3D={vi.fn()} onOpenDesign={onOpenDesign} onOpenCalc={onOpenCalc} /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /Ejercicio en blanco/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /Ejercicios de diseño en Cálculo/ }));
    expect(onOpenCalc).toHaveBeenCalledTimes(1);
    expect(onOpenDesign).not.toHaveBeenCalled();
  });
});

describe('HomePage: dos apartados', () => {
  it('Cálculo abre un tema y Proyecto abre cada modo de la mesa', async () => {
    window.history.replaceState({}, '', '?surface=welcome');
    const user = userEvent.setup();
    const onOpenWorkspace = vi.fn();
    const onOpenSpace3D = vi.fn();
    const onOpenDesign = vi.fn();
    const onOpenCalc = vi.fn();
    render(<ProjectProvider><HomePage onOpenWorkspace={onOpenWorkspace} onOpenSpace3D={onOpenSpace3D} onOpenDesign={onOpenDesign} onOpenCalc={onOpenCalc} /></ProjectProvider>);
    expect(screen.getByRole('heading', { name: 'Cálculo' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Proyecto' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cortante' }));
    expect(onOpenCalc).toHaveBeenLastCalledWith({ topic: 'shear-beam' });
    await user.click(screen.getByRole('button', { name: /Piezas completas/ }));
    expect(onOpenCalc).toHaveBeenLastCalledWith({ piece: 'beam' });
    await user.click(screen.getByRole('button', { name: /Modelo 3D/ }));
    expect(onOpenSpace3D).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /Diseño/ }));
    expect(onOpenDesign).toHaveBeenCalledWith('project');
    await user.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(onOpenWorkspace).toHaveBeenCalled();
  });
});
