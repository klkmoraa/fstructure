// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTopBar, type WorkspaceTopBarLabels } from './WorkspaceTopBar';

const labels: WorkspaceTopBarLabels = {
  solverName: 'FStructure',
  project: 'Proyecto actual',
  openProject: 'Abrir proyecto',
  storageReady: 'Guardado local',
  storageIssue: 'Error al guardar',
  analysisReady: 'Listo para analizar',
  analysisRunning: 'Analizando…',
  analysisResolved: 'Análisis actualizado',
  undo: 'Deshacer',
  redo: 'Rehacer',
  analyze: 'Analizar',
  results: 'Resultados',
  actions: 'Acciones del espacio de trabajo',
};

afterEach(() => cleanup());

describe('WorkspaceTopBar', () => {
  it('keeps project and analysis status visible without opening another surface', () => {
    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Viga de prueba"
        storageState="ready"
        analysisState="resolved"
        resultsOpen={false}
        canUndo={false}
        canRedo
        onOpenProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
      />,
    );

    expect(screen.getByRole('banner')).toHaveAttribute('data-workspace-topbar');
    expect(screen.getByText('Viga de prueba')).toBeInTheDocument();
    expect(screen.getByText('Guardado local')).toBeInTheDocument();
    expect(screen.getByText('Análisis actualizado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeEnabled();
  });

  it('routes the four primary actions and exposes Results as a toggle', async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onAnalyze = vi.fn();
    const onOpenResults = vi.fn();

    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Modelo"
        storageState="issue"
        storageMessage="No se pudo guardar"
        analysisState="running"
        resultsOpen
        canUndo
        canRedo
        onOpenProject={onOpenProject}
        onUndo={onUndo}
        onRedo={onRedo}
        onAnalyze={onAnalyze}
        onOpenResults={onOpenResults}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Abrir proyecto/ }));
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await user.click(screen.getByRole('button', { name: 'Rehacer' }));
    await user.click(screen.getByRole('button', { name: 'Resultados' }));

    expect(onOpenProject).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    expect(onOpenResults).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Analizando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resultados' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Error al guardar')).toBeInTheDocument();
  });
});
