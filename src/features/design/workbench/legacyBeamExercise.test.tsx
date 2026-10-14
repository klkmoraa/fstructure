// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { BEAM_DEFAULTS, DEFAULT_SPANS } from './beamModel';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});

describe('legacy beam exercise draft', () => {
  it('keeps the saved exercise id readable and in memory without showing the retired guide', async () => {
    const user = userEvent.setup();
    localStorage.setItem('fstructure.design-workbench.beam', JSON.stringify({
      ...BEAM_DEFAULTS, exercise: 'exercise-beam-simple', leftEnd: 'pin', rightEnd: 'roller', selfWeight: 'no',
    }));
    localStorage.setItem('fstructure.design-workbench.beam-spans', JSON.stringify([{ ...DEFAULT_SPANS[0]!, length: '5', dead: '10', live: '0' }]));
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider>);

    expect(screen.queryByRole('region', { name: 'Viga simplemente apoyada' })).toBeNull();
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.beam')!).exercise).toBe('exercise-beam-simple');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const memory = JSON.parse(localStorage.getItem('fstructure.design-workbench.memory')!);
    expect(memory).toEqual(expect.arrayContaining([expect.objectContaining({ fields: expect.objectContaining({ exercise: 'exercise-beam-simple' }) })]));
  });
});
