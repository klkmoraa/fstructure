// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { ShellMoreMenu } from './ShellMoreMenu';
import { OPEN_HELP_EVENT } from './WorkspaceHelp';

afterEach(() => cleanup());

const renderMenu = () => render(<ProjectProvider><ShellMoreMenu /></ProjectProvider>);

describe('ShellMoreMenu', () => {
  it('abre con el botón, cambia el tema y se cierra con Escape devolviendo el foco', async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Más opciones' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const before = document.documentElement.dataset.theme;
    await user.click(screen.getByRole('menuitem', { name: /Tema (oscuro|claro)/ }));
    expect(document.documentElement.dataset.theme).not.toBe(before);
    // Elegir el tema cierra el menú; al abrirlo otra vez, Escape lo cierra y devuelve el foco.
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Más opciones' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('pide la guía sin conocer el componente que la muestra', async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();
    window.addEventListener(OPEN_HELP_EVENT, onHelp);
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Guía' }));
    window.removeEventListener(OPEN_HELP_EVENT, onHelp);
    expect(onHelp).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Más opciones' })).toBeNull();
  });

  it('en teléfono encabeza el menú con los controles de la herramienta; elegir uno lo cierra y devuelve el foco', async () => {
    const user = userEvent.setup();
    const onBring = vi.fn();
    render(<ProjectProvider><ShellMoreMenu tools={<button type="button" className="workspace-topbar__action-button" onClick={onBring}>Traer del 2D</button>} /></ProjectProvider>);
    const trigger = screen.getByRole('button', { name: 'Más opciones' });
    await user.click(trigger);
    const tools = screen.getByRole('group', { name: 'Herramientas principales' });
    await user.click(within(tools).getByRole('button', { name: 'Traer del 2D' }));
    expect(onBring).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Más opciones' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
