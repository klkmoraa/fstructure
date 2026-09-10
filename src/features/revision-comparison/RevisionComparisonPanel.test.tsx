// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { unavailableAnalysis } from '../../engine/analysisFailure';
import { saveProjectToStorage } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { InMemoryProjectRepository } from '../../storage/projectRepository';
import { RevisionComparisonPanel } from './RevisionComparisonPanel';
import type { RevisionSnapshot } from './revisionComparison';

afterEach(cleanup);

const fixtureSnapshot = (): RevisionSnapshot => {
  const project = createBlankProject();
  const result = {
    ...unavailableAnalysis('fixture'),
    success: true,
    nodeResults: [{ nodeId: 'N1', ux: 0, uy: 0, rz: 0, rx: 0, ry: 0, rm: 0 }],
    displacements: [0],
    reliability: undefined,
  };
  return {
    schemaVersion: 1,
    kind: 'fusionstructure-revision-snapshot',
    revisionId: 'sha256:fixture-project',
    capturedAt: '2026-09-09T12:00:00.000Z',
    project,
    analysis: {
      result,
      projectSignature: 'fixture-signature',
      resultDigest: 'sha256:fixture-result',
      scenarioId: 'case:LC1',
    },
  };
};

describe('historial persistente de corridas', () => {
  it('carga, guarda, usa como base y elimina una corrida nombrada', async () => {
    const user = userEvent.setup();
    const repository = new InMemoryProjectRepository();
    const snapshot = fixtureSnapshot();
    saveProjectToStorage(localStorage, snapshot.project);

    render(
      <ProjectProvider>
        <RevisionComparisonPanel
          open
          onOpenChange={() => undefined}
          repository={repository}
          captureSnapshot={() => Promise.resolve(snapshot)}
          baseline={null}
          onBaselineChange={() => undefined}
        />
      </ProjectProvider>,
    );

    await screen.findByTestId('revision-comparison');
    const label = screen.getByRole('textbox', { name: 'Nombre de la corrida' });
    await user.type(label, 'Corrida base');
    await user.click(screen.getByRole('button', { name: 'Guardar corrida' }));

    await waitFor(async () => {
      expect((await repository.listAnalysisRuns(snapshot.project.id)).map((run) => run.label)).toEqual(['Corrida base']);
    });
    expect((await screen.findByRole('status')).textContent).toBe('Corrida guardada en el historial.');
    expect(screen.getByRole('button', { name: 'Usar como base: Corrida base' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Usar como base: Corrida base' }));
    expect(screen.getByText('Corrida base')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Eliminar corrida: Corrida base' }));
    await waitFor(async () => expect(await repository.listAnalysisRuns(snapshot.project.id)).toEqual([]));
    expect(screen.queryByRole('button', { name: 'Usar como base: Corrida base' })).toBeNull();
  });
});
