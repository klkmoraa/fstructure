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

  it('pertenece sólo al Modelo 2D: no ofrece saltos a otras herramientas', async () => {
    const user = userEvent.setup();

    render(
      <ProjectProvider>
        <WorkspaceUtilities onOpenInspector={vi.fn()} />
      </ProjectProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Herramientas del espacio de trabajo' }));

    expect(screen.queryByRole('region', { name: 'Herramientas integradas' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Modelo 3D/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^FEM/ })).toBeNull();
  });
});
