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
  it('conserva el modelo vacío y abre la sección a flexión como cálculo individual', async () => {
    const user = userEvent.setup();
    const onOpenDesign = vi.fn();
    const onOpenWorkspace = vi.fn();
    render(<ProjectProvider><HomePage onOpenWorkspace={onOpenWorkspace} onOpenSpace3D={vi.fn()} onOpenDesign={onOpenDesign} /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /Ejercicio en blanco/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await user.keyboard('{Escape}');
    const button = screen.getByRole('button', { name: /Resolver sección y acero/ });
    await user.click(button);
    expect(onOpenWorkspace).toHaveBeenCalledWith('design');
    expect(onOpenDesign).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /Resolver sección y acero/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Viga simplemente apoyada/ })).toBeNull();
  });
});

describe('HomePage: por separado o proyecto completo', () => {
  it('cada pantalla individual crea su propio archivo y abre sólo su modo', async () => {
    window.history.replaceState({}, '', '?surface=welcome');
    const user = userEvent.setup();
    const onOpenWorkspace = vi.fn();
    const onOpenSpace3D = vi.fn();
    const onOpenDesign = vi.fn();
    render(<ProjectProvider><HomePage onOpenWorkspace={onOpenWorkspace} onOpenSpace3D={onOpenSpace3D} onOpenDesign={onOpenDesign} /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /^Modelo 3D.*Marcos espaciales$/ }));
    expect(onOpenWorkspace).toHaveBeenLastCalledWith('3d');
    expect(await screen.findByText(/Cálculo individual abierto · Modelo 3D/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Zapata/ }));
    expect(onOpenWorkspace).toHaveBeenLastCalledWith('design');
    expect(await screen.findByText(/Cálculo individual abierto · Zapata/)).toBeTruthy();
    // Con un individual abierto, los modos del proyecto empiezan un proyecto nuevo.
    await user.click(screen.getByRole('button', { name: /Edificios y marcos espaciales/ }));
    expect(onOpenSpace3D).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Proyecto abierto')).toBeTruthy();
  });
});
