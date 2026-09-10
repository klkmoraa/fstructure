// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveProjectToStorage } from '../../data/projectStorage';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { useParametricStudy } from '../../engine/useParametricStudy';
import { ProjectProvider } from '../../store/ProjectContext';
import type { ParametricStudyResult } from '../../engine/parametricStudy';
import { ParametricStudyCard } from './ParametricStudyCard';

vi.mock('../../engine/useParametricStudy', () => ({ useParametricStudy: vi.fn() }));

afterEach(cleanup);

const fixtureStudy = (memberId: string): ParametricStudyResult => ({
  memberId,
  parameter: 'E',
  baseValue: 200_000,
  combinationId: null,
  variants: [
    { factor: 0.8, parameterValue: 160_000, success: true, reliability: 'reliable', metrics: { axial: 10, shear: 0, moment: 0, deformation: 0.0125 } },
    { factor: 1, parameterValue: 200_000, success: true, reliability: 'reliable', metrics: { axial: 10, shear: 0, moment: 0, deformation: 0.01 } },
  ],
});

describe('ParametricStudyCard', () => {
  beforeEach(() => {
    const fixture = availableSolver2dCorpus.find((item) => item.id === 'axial-bar');
    if (!fixture) throw new Error('No se encontró el fixture axial-bar.');
    saveProjectToStorage(localStorage, resolveCorpusProject(fixture));
    vi.mocked(useParametricStudy).mockReturnValue({
      study: fixtureStudy('AB'),
      busy: false,
      error: null,
      run: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('muestra el barrido y lanza una solicitud con factores validados', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><ParametricStudyCard /></ProjectProvider>);

    expect(screen.getByTestId('parametric-study-card')).toBeTruthy();
    expect(screen.getByText('Estudio paramétrico')).toBeTruthy();
    expect(screen.getByText('160 MPa')).toBeTruthy();
    expect(screen.getByText('0.0125 m')).toBeTruthy();

    const factors = screen.getByRole('textbox', { name: 'Factores relativos' });
    await user.clear(factors);
    await user.type(factors, '0.7, 1, 1.3');
    await user.click(screen.getByRole('button', { name: 'Calcular estudio' }));

    expect(vi.mocked(useParametricStudy).mock.results[0]?.value.run).toHaveBeenCalledWith({ memberId: 'AB', parameter: 'E', factors: [0.7, 1, 1.3] });
  });
});
