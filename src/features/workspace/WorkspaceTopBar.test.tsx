// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTopBar, type WorkspaceTopBarLabels } from './WorkspaceTopBar';
const workspaceTopbarCss = readFileSync('src/features/workspace/workspaceTopbar.css', 'utf8');

const labels: WorkspaceTopBarLabels = {
  solverName: 'FStructure',
  project: 'Proyecto actual',
  home: 'Ir al inicio',
  editProject: 'Nombre del proyecto',
  saveProject: 'Guardar',
  cancel: 'Cancelar',
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
  calculationExperience: 'Experiencia y cálculo',
  actions: 'Acciones del espacio de trabajo',
};

afterEach(() => cleanup());

const renderTopbar = () => render(<WorkspaceTopBar labels={labels} projectName="Modelo"
  storageState="ready" analysisState="ready" resultsOpen={false} canUndo={false} canRedo={false}
  onOpenHome={() => undefined} onRenameProject={() => undefined} onUndo={() => undefined}
  onRedo={() => undefined} onAnalyze={() => undefined} onOpenResults={() => undefined} />);

it('cancela el nombre con Escape y devuelve el foco al proyecto', async () => {
  const user = userEvent.setup();
  renderTopbar();
  const trigger = screen.getByRole('button', { name: 'Nombre del proyecto: Modelo' });
  await user.click(trigger);
  await user.type(screen.getByRole('textbox'), ' cambiado');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(screen.getByText('Modelo')).toBeTruthy();
});

it('abre ayuda de la mesa y Escape vuelve al control que la abrió', async () => {
  const user = userEvent.setup();
  renderTopbar();
  const trigger = screen.getByRole('button', { name: 'Cómo usar FStructure' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Cómo usar FStructure' })).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

describe('WorkspaceTopBar', () => {
  it('la marca vuelve al inicio y la barra no ofrece saltos a otras herramientas', async () => {
    const user = userEvent.setup();
    const onOpenHome = vi.fn();
    render(<WorkspaceTopBar
      labels={labels}
      tool="model2d"
      projectName="Modelo"
      storageState="ready"
      analysisState="ready"
      resultsOpen={false}
      canUndo={false}
      canRedo={false}
      onOpenHome={onOpenHome}
      onRenameProject={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onAnalyze={vi.fn()}
      onOpenResults={vi.fn()}
    />);

    const brand = screen.getByRole('button', { name: labels.home });
    expect(brand.getAttribute('aria-haspopup')).toBeNull();
    await user.click(brand);
    expect(onOpenHome).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Diseño$|^3D$|^2D$|^FEM$/ })).toBeNull();
  });

  it('una herramienta aislada pinta sus propios controles en lugar de los del Modelo 2D', () => {
    render(<WorkspaceTopBar
      labels={labels}
      tool="fem"
      contextActive={false}
      primaryAction={<button type="button">Analizar FEM</button>}
      toolStatus={<span role="status">Malla lista</span>}
      projectName="Placa"
      storageState="ready"
      analysisState="ready"
      resultsOpen={false}
      canUndo={false}
      canRedo={false}
      onOpenHome={vi.fn()}
      onRenameProject={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onAnalyze={vi.fn()}
      onOpenResults={vi.fn()}
    />);

    expect(screen.getByRole('banner').getAttribute('data-tool')).toBe('fem');
    expect(screen.getByRole('button', { name: 'Analizar FEM' })).toBeTruthy();
    expect(screen.getByText('Malla lista')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resultados' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Analizar' })).toBeNull();
  });

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
        onOpenHome={vi.fn()}
        onRenameProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
      />,
    );

    expect(screen.getByRole('banner').getAttribute('data-workspace-topbar')).toBe('true');
    expect(screen.getByText('Viga de prueba')).toBeTruthy();
    expect(screen.queryByText('Guardado local')).toBeNull();
    expect(screen.getByText('Análisis actualizado')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Deshacer' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Rehacer' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('routes the four primary actions and exposes Results as a toggle', async () => {
    const user = userEvent.setup();
    const onOpenHome = vi.fn();
    const onRenameProject = vi.fn();
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
        onOpenHome={onOpenHome}
        onRenameProject={onRenameProject}
        onUndo={onUndo}
        onRedo={onRedo}
        onAnalyze={onAnalyze}
        onOpenResults={onOpenResults}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await user.click(screen.getByRole('button', { name: 'Rehacer' }));
    await user.click(screen.getByRole('button', { name: 'Resultados' }));

    expect(onOpenHome).toHaveBeenCalledOnce();
    expect(onRenameProject).not.toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    expect(onOpenResults).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Analizando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Resultados' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Error al guardar')).toBeTruthy();
  });

  it('lleva la marca al inicio y permite cambiar el nombre desde su propio control', async () => {
    const user = userEvent.setup();
    const onOpenHome = vi.fn();
    const onRenameProject = vi.fn();

    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Pórtico de ejemplo"
        storageState="ready"
        analysisState="ready"
        resultsOpen={false}
        canUndo={false}
        canRedo={false}
        onOpenHome={onOpenHome}
        onRenameProject={onRenameProject}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }));
    await user.click(screen.getByRole('button', { name: 'Nombre del proyecto: Pórtico de ejemplo' }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Pórtico norte');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onOpenHome).toHaveBeenCalledOnce();
    expect(onRenameProject).toHaveBeenCalledWith('Pórtico norte');
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
        onOpenHome={vi.fn()}
        onRenameProject={vi.fn()}
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

  it('abre la experiencia y configuración de cálculo desde la barra superior', async () => {
    const user = userEvent.setup();
    const onOpenCalculationExperience = vi.fn();

    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Modelo"
        storageState="ready"
        analysisState="ready"
        resultsOpen={false}
        canUndo={false}
        canRedo={false}
        onOpenHome={vi.fn()}
        onRenameProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
        onOpenCalculationExperience={onOpenCalculationExperience}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Experiencia y cálculo' }));

    expect(onOpenCalculationExperience).toHaveBeenCalledOnce();
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
        onOpenHome={vi.fn()}
        onRenameProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
      />,
    );

    expect(screen.getByText('No se pudo analizar')).toBeTruthy();
    expect(screen.queryByText('Listo para analizar')).toBeNull();
  });

  it('no recorta el editor de nombre fuera del grupo del proyecto', async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceTopBar
        labels={labels}
        projectName="Modelo"
        storageState="ready"
        analysisState="ready"
        resultsOpen={false}
        canUndo={false}
        canRedo={false}
        onOpenHome={vi.fn()}
        onRenameProject={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onAnalyze={vi.fn()}
        onOpenResults={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Nombre del proyecto: Modelo' }));
    expect(screen.getByRole('form', { name: labels.editProject })).toBeTruthy();

    const projectGroupRules = workspaceTopbarCss
      .split('.workspace-topbar__project-group {')
      .slice(1)
      .map((section) => section.split('}')[0] ?? '');

    expect(projectGroupRules.length).toBeGreaterThan(0);
    expect(projectGroupRules.some((rule) => rule.includes('overflow: hidden'))).toBe(false);
  });

});
