// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { StiffnessEditor } from './StiffnessEditor';

beforeEach(() => { localStorage.clear(); localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject())); });
afterEach(cleanup);
function Harness() {
  const { project } = useProject();
  return <><StiffnessEditor /><StiffnessEditor member={project.members[0]} /><output data-testid="rigidity">{project.members[0].E * project.members[0].I}</output></>;
}
it('configura una base 2EI, vincula una barra y permite un factor propio', async () => {
  const user = userEvent.setup();
  render(<ProjectProvider><Harness /></ProjectProvider>);
  await user.selectOptions(screen.getAllByLabelText('Constante del proyecto')[0]!, 'EI');
  const defaultFactor = (await screen.findAllByLabelText('Factor predeterminado'))[0]!;
  await user.clear(defaultFactor); await user.type(defaultFactor, '2'); await user.tab();
  await user.click(await screen.findByRole('button', { name: 'Usar constante' }));
  expect(Number(screen.getByTestId('rigidity').textContent)).toBeCloseTo(3333.2);
  const factor = await screen.findByLabelText('Factor de M1');
  await user.clear(factor); await user.type(factor, '3'); await user.tab();
  expect(Number(screen.getByTestId('rigidity').textContent)).toBeCloseTo(4999.8);
  await user.click(screen.getByRole('button', { name: 'Valores propios' }));
  expect(screen.queryByLabelText('Factor de M1')).toBeNull();
});
