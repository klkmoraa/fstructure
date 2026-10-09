// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignStartDialog } from './DesignStartDialog';
import type { DesignStart } from './designStarts';

afterEach(cleanup);

const renderDialog = (overrides: Partial<{
  onOpenChange: (open: boolean) => void;
  onStart: (start: DesignStart) => 'started' | 'full';
  onOpenModel: () => void;
  onOpenSpace3D: () => void;
  onCreateBuilding: () => void;
  initialCategory: 'project' | 'piece' | 'exercise';
}> = {}) => render(<DesignStartDialog open onOpenChange={overrides.onOpenChange ?? vi.fn()}
  hasModel2d={false} hasModel3d={false} code="ntc-2023" projectName="Casa" onStart={overrides.onStart ?? vi.fn((): 'started' => 'started')}
  onOpenModel={overrides.onOpenModel} onOpenSpace3D={overrides.onOpenSpace3D} onCreateBuilding={overrides.onCreateBuilding} initialCategory={overrides.initialCategory} />);

describe('DesignStartDialog', () => {
  it('explica por qué no puede iniciar desde modelos vacíos y ofrece modelarlos', async () => {
    const user = userEvent.setup();
    const onOpenModel = vi.fn();
    const onOpenSpace3D = vi.fn();
    const onCreateBuilding = vi.fn();
    renderDialog({ onOpenModel, onOpenSpace3D, onCreateBuilding });
    const dialog = screen.getByRole('dialog', { name: 'Nuevo diseño' });
    expect(within(dialog).getByText(/Proyecto: Casa · Norma vigente/)).toBeTruthy();
    expect(within(dialog).getByText(/no tiene vigas o columnas de concreto disponibles/i)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Modelo 2D no disponible' })).toHaveProperty('disabled', true);
    await user.click(within(dialog).getByRole('button', { name: 'Modelar en 2D' }));
    expect(onOpenModel).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Crear edificio' }));
    expect(onCreateBuilding).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Modelar en 3D' }));
    expect(onOpenSpace3D).toHaveBeenCalledOnce();
  });

  it('muestra los formularios propios y deja que el callback controle el inicio', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(() => 'started' as const);
    renderDialog({ onStart });
    const dialog = screen.getByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(dialog).getByRole('tab', { name: 'Ejercicio' }));
    const exercise = within(dialog).getByRole('tabpanel');
    expect(within(exercise).getByRole('heading', { name: 'Sección con acciones dadas' })).toBeTruthy();
    await user.click(within(exercise).getByRole('button', { name: /Sección con acciones dadas/ }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'problem-section', fields: expect.any(Object) }));
  });

  it('cambia de categoría con las flechas de las pestañas', async () => {
    const user = userEvent.setup();
    renderDialog();
    const close = screen.getByRole('button', { name: 'Cerrar nuevo diseño' });
    await waitFor(() => expect(document.activeElement).toBe(close));
    const project = screen.getByRole('tab', { name: 'Proyecto' });
    await user.click(project);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Pieza' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('Zapata aislada');
  });

  it('abre directamente la categoría pedida por el inicio externo', () => {
    renderDialog({ initialCategory: 'exercise' });
    expect(screen.getByRole('tab', { name: 'Ejercicio' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('Sección con acciones dadas');
  });
});
