// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { HomePage } from './HomePage';
import { IDBFactory } from 'fake-indexeddb';
import { getProjectRepository } from '../../storage/projectRepository';

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

describe('HomePage: navegación y recursos', () => {
  it('conserva el acceso al aula, la importación y la biblioteca desde Recursos', async () => {
    window.history.replaceState({}, '', '?surface=welcome');
    const user = userEvent.setup();
    const onOpenWorkspace = vi.fn();
    render(<ProjectProvider><HomePage onOpenWorkspace={onOpenWorkspace} onOpenSpace3D={vi.fn()} onOpenDesign={vi.fn()} /></ProjectProvider>);
    const navigation = within(screen.getByRole('navigation', { name: 'Navegación principal' }));

    await user.click(navigation.getByRole('button', { name: 'Recursos' }));
    await user.click(screen.getByRole('button', { name: 'Aula' }));
    await user.click(screen.getByRole('button', { name: /Resolver sección y acero/ }));
    expect(onOpenWorkspace).toHaveBeenLastCalledWith('design');
    expect(navigation.getByRole('button', { name: 'Recursos' }).getAttribute('aria-current')).toBe('page');

    await user.click(navigation.getByRole('button', { name: 'Recursos' }));
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(new URLSearchParams(window.location.search).get('view')).toBe('import');
    expect(screen.getByRole('button', { name: /Geometría DXF/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Proyecto o expediente/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    await user.keyboard('{Escape}');

    await user.click(navigation.getByRole('button', { name: 'Recursos' }));
    await user.click(screen.getByRole('button', { name: 'Biblioteca' }));
    await user.click(await screen.findByRole('button', { name: 'Crear favorito' }));
    expect(screen.getByRole('textbox', { name: 'Nombre del favorito' })).toBeTruthy();

    await user.click(navigation.getByRole('button', { name: 'Inicio' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onOpenWorkspace).toHaveBeenLastCalledWith('design');
  });

  it('cierra el diálogo abierto y restaura la sección al retroceder y avanzar en el historial', async () => {
    window.history.replaceState({}, '', '?surface=welcome');
    const user = userEvent.setup();
    render(<ProjectProvider><HomePage onOpenWorkspace={vi.fn()} onOpenSpace3D={vi.fn()} onOpenDesign={vi.fn()} /></ProjectProvider>);
    const navigation = within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    await user.click(navigation.getByRole('button', { name: 'Recursos' }));
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.getByRole('heading', { name: 'Importar', level: 1 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Proyecto o expediente/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();

    window.history.back();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Recursos', level: 1 })).toBeTruthy());
    expect(new URLSearchParams(window.location.search).get('view')).toBe('resources');
    expect(screen.queryByRole('dialog')).toBeNull();

    window.history.back();
    await waitFor(() => expect(navigation.getByRole('button', { name: 'Inicio' }).getAttribute('aria-current')).toBe('page'));
    expect(new URLSearchParams(window.location.search).has('view')).toBe(false);

    window.history.forward();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Recursos', level: 1 })).toBeTruthy());
    expect(navigation.getByRole('button', { name: 'Recursos' }).getAttribute('aria-current')).toBe('page');

    window.history.forward();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Importar', level: 1 })).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('HomePage Proyectos: búsqueda sin coincidencias', () => {
  it('dice que ningún proyecto coincide y «Limpiar filtros» borra la búsqueda y restaura la lista', async () => {
    globalThis.indexedDB = new IDBFactory();
    await getProjectRepository().saveProject({ ...createDefaultProject(), id: 'p-1', name: 'Nave industrial' });
    window.history.replaceState({}, '', '?surface=welcome&view=projects');
    const user = userEvent.setup();
    render(<ProjectProvider><HomePage onOpenWorkspace={vi.fn()} onOpenSpace3D={vi.fn()} onOpenDesign={vi.fn()} /></ProjectProvider>);
    expect(await screen.findByText('Nave industrial')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'puente');
    expect(await screen.findByText('Ningún proyecto coincide con el filtro.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect((screen.getByRole('searchbox', { name: 'Buscar' }) as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Nave industrial')).toBeTruthy();
    expect(screen.queryByText('Ningún proyecto coincide con el filtro.')).toBeNull();
  });
});
