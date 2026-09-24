// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../data/projectStorage';
import { unavailableAnalysis } from '../engine/analysisFailure';
import { ProjectProvider, useProjectAnalysis, useProjectModel } from './ProjectContext';

const Harness = () => {
  const { project, replaceProject, updateProject, undo } = useProjectModel();
  const { analysis } = useProjectAnalysis();

  return <>
    <output data-testid="analysis">{analysis?.issues[0]?.message ?? 'none'}</output>
    <button onClick={() => replaceProject(project, unavailableAnalysis('resultado vigente'))}>Restaurar resultado</button>
    <button onClick={() => updateProject((draft) => ({
      ...draft,
      members: draft.members.map((member, index) => index === 0 ? { ...member, E: member.E + 1 } : member),
    }))}>Editar estructura</button>
    <button onClick={undo}>Deshacer</button>
  </>;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});

afterEach(cleanup);

describe('ProjectProvider history', () => {
  it('invalida el AnalysisResult en un cambio estructural y en su deshacer', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);

    await user.click(screen.getByRole('button', { name: 'Restaurar resultado' }));
    await user.click(screen.getByRole('button', { name: 'Editar estructura' }));
    expect(screen.getByTestId('analysis').textContent).toBe('none');

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByTestId('analysis').textContent).toBe('none');
  });
});
