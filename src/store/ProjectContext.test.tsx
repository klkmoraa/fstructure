// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../data/projectStorage';
import { unavailableAnalysis } from '../engine/analysisFailure';
import { ProjectProvider, useProjectAnalysis, useProjectModel } from './ProjectContext';

const Harness = () => {
  const { project, replaceProject, updateProject, updateProjectDesign, undo, redo } = useProjectModel();
  const { analysis } = useProjectAnalysis();
  const assignmentCount = project.designAssignments?.length ?? 0;
  const [designError, setDesignError] = useState('none');

  return <>
    <output data-testid="analysis">{analysis?.issues[0]?.message ?? 'none'}</output>
    <output data-testid="assignments">{assignmentCount}</output>
    <output data-testid="member-e">{project.members[0]?.E ?? 'none'}</output>
    <output data-testid="design-error">{designError}</output>
    <button onClick={() => replaceProject(project, unavailableAnalysis('resultado vigente'))}>Restaurar resultado</button>
    <button onClick={() => updateProjectDesign((draft) => ({
      ...draft,
      designAssignments: [{
        id: 'DESIGN-M2', memberId: 'M2', kind: 'reinforced-concrete-beam', standardId: 'ntc-cdmx-2023-concrete',
        ultimateCombinationId: 'NTC-CDMX-2023-ORD', serviceCombinationId: 'COMB1', coverMm: 40,
        longitudinalSteelYieldMpa: 420, stirrupSteelYieldMpa: 420,
        preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32], preferredStirrupDiametersMm: [8, 10, 12], stirrupLegs: 2,
      }],
    }))}>Asignar diseño</button>
    <button onClick={() => updateProject((draft) => ({
      ...draft,
      members: draft.members.map((member, index) => index === 0 ? { ...member, E: member.E + 1 } : member),
    }))}>Editar estructura</button>
    <button onClick={() => {
      try {
        updateProjectDesign((draft) => ({
          ...draft,
          members: draft.members.map((member, index) => index === 0 ? { ...member, E: member.E + 1 } : member),
        }));
      } catch (error) {
        setDesignError(error instanceof Error ? error.message : String(error));
      }
    }}>Corromper desde diseño</button>
    <button onClick={undo}>Deshacer</button>
    <button onClick={redo}>Rehacer</button>
  </>;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});

afterEach(cleanup);

describe('ProjectProvider history', () => {
  it('preserva el AnalysisResult al editar, deshacer y rehacer diseño', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);

    await user.click(screen.getByRole('button', { name: 'Restaurar resultado' }));
    await user.click(screen.getByRole('button', { name: 'Asignar diseño' }));
    expect(screen.getByTestId('analysis').textContent).toBe('resultado vigente');
    expect(screen.getByTestId('assignments').textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByTestId('analysis').textContent).toBe('resultado vigente');
    expect(screen.getByTestId('assignments').textContent).toBe('0');

    await user.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(screen.getByTestId('analysis').textContent).toBe('resultado vigente');
    expect(screen.getByTestId('assignments').textContent).toBe('1');
  });

  it('sigue invalidando el AnalysisResult para cambios estructurales y su undo', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);

    await user.click(screen.getByRole('button', { name: 'Restaurar resultado' }));
    await user.click(screen.getByRole('button', { name: 'Editar estructura' }));
    expect(screen.getByTestId('analysis').textContent).toBe('none');

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByTestId('analysis').textContent).toBe('none');
  });

  it('rechaza cambios estructurales enviados por la ruta de diseño', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    const initialE = screen.getByTestId('member-e').textContent;

    await user.click(screen.getByRole('button', { name: 'Restaurar resultado' }));
    await user.click(screen.getByRole('button', { name: 'Corromper desde diseño' }));

    expect(screen.getByTestId('design-error').textContent).toMatch(/sólo puede modificar asignaciones de diseño/i);
    expect(screen.getByTestId('member-e').textContent).toBe(initialE);
    expect(screen.getByTestId('analysis').textContent).toBe('resultado vigente');
  });
});
