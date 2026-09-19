// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { WorkspaceUtilities } from './WorkspaceUtilities';

afterEach(() => cleanup());

describe('WorkspaceUtilities', () => {
  it('muestra los catorce perfiles y permite abrir el editor de unidades personalizadas', async () => {
    const user = userEvent.setup();
    const onOpenUnitsEditor = vi.fn();

    render(
      <ProjectProvider>
        <WorkspaceUtilities
          activeWorkspace="model2d"
          onOpenModel2D={vi.fn()}
          onOpenSpace3D={vi.fn()}
          onOpenFem={vi.fn()}
          onOpenInspector={vi.fn()}
          onOpenUnitsEditor={onOpenUnitsEditor}
        />
      </ProjectProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Herramientas del espacio de trabajo' }));
    await user.click(screen.getByRole('button', { name: 'kN · m' }));

    expect(screen.getAllByRole('option')).toHaveLength(14);

    await user.click(screen.getByRole('button', { name: /Personalizar unidades…/ }));
    expect(onOpenUnitsEditor).toHaveBeenCalledOnce();
  });

  it('ofrece herramientas integradas y cierra el panel al abrir una', async () => {
    const user = userEvent.setup();
    const onOpenSpace3D = vi.fn();

    render(
      <ProjectProvider>
        <WorkspaceUtilities
          activeWorkspace="model2d"
          onOpenModel2D={vi.fn()}
          onOpenSpace3D={onOpenSpace3D}
          onOpenFem={vi.fn()}
          onOpenInspector={vi.fn()}
        />
      </ProjectProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Herramientas del espacio de trabajo' }));

    expect(screen.getByRole('region', { name: 'Herramientas integradas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Modelo 2D/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Modelo 3D.*Experimental/ }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /FEM.*Experimental/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Modelo 3D.*Experimental/ }));

    expect(onOpenSpace3D).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Herramientas del espacio de trabajo' })).toBeNull();
  });
});
