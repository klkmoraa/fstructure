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
  storageRecovered: 'Recuperado',
  storageIssue: 'Error al guardar',
  analysisReady: 'Listo para analizar',
  analysisRunning: 'Analizando…',
  analysisResolved: 'Análisis actualizado',
  analysisFailed: 'No se pudo analizar',
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

    expect(screen.getByRole('banner').getAttribute('data-workspace-topbar')).toBe('true');
    expect(screen.getByText('Viga de prueba')).toBeTruthy();
    expect(screen.getByText('Guardado local')).toBeTruthy();
    expect(screen.getByText('Análisis actualizado')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Deshacer' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Rehacer' }) as HTMLButtonElement).disabled).toBe(false);
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
    expect((screen.getByRole('button', { name: 'Analizando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Resultados' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Error al guardar')).toBeTruthy();
  });

  /**
   * El botón anuncia su estado con `aria-pressed`, así que tiene que poder
   * apagarlo: antes llamaba a `openSurface`, que sobre una superficie ya activa
   * sólo renueva su activación, y Resultados no se cerraba nunca desde aquí.
   * La barra no decide cómo se cierra —eso es del shell—, pero sí entrega su
   * propio disparador para que el foco vuelva a él.
   */
  it('el control de Resultados alterna y entrega su disparador', async () => {
    const user = userEvent.setup();
    const onOpenResults = vi.fn();

    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Modelo"
        storageState="ready"
        analysisState="resolved"
        resultsOpen
        canUndo
        canRedo
        onOpenProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={onOpenResults}
      />,
    );

    const control = screen.getByRole('button', { name: 'Resultados' });
    expect(control.getAttribute('aria-pressed')).toBe('true');
    await user.click(control);
    expect(onOpenResults).toHaveBeenCalledWith(control);
  });

  /**
   * Un análisis que falló no es un modelo sin correr. Colapsar los dos en
   * `ready` ponía «Listo para analizar» encima de una corrida fallida, que es
   * el estado que más importa y el que quedaba escondido.
   */
  it('un análisis fallido se nombra como fallido, no como listo', () => {
    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Modelo"
        storageState="ready"
        analysisState="failed"
        resultsOpen={false}
        canUndo={false}
        canRedo={false}
        onOpenProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
      />,
    );

    expect(screen.getByText('No se pudo analizar')).toBeTruthy();
    expect(screen.queryByText('Listo para analizar')).toBeNull();
  });
});
