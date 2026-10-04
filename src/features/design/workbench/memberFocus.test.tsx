// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConcreteFrameProject, createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { designStructure } from '../../../design/elements/structure';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { designOfMember, memberIdsOf, structureOptions, FRAME_DEFAULTS } from './frameModel';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const source = () => model2dDesignSource(createConcreteFrameProject());

it('cada barra del modelo lleva a su viga continua o a su columna, y de vuelta', () => {
  const external = source();
  const result = designStructure(external.create({ braced: false })!, { ...structureOptions('nsr-10', { ...FRAME_DEFAULTS, source: 'model' }), fcMpa: external.fcMpa ?? 28, includeSelfWeight: external.includesSelfWeight });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  // Los dos tramos del nivel 1 son una viga continua.
  const beam = designOfMember(result, 'V21')!;
  expect(designOfMember(result, 'V11')).toBe(beam);
  expect(memberIdsOf(result, beam)).toEqual(['V11', 'V21']);
  const column = designOfMember(result, 'C22')!;
  expect(memberIdsOf(result, column)).toEqual(['C22']);
  expect(designOfMember(result, 'no-existe')).toBeNull();
});

it('Diseño abre la barra elegida en el 2D y «Ver en el Modelo» la devuelve', async () => {
  const user = userEvent.setup();
  const onShowMembers = vi.fn();
  render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="model" modelSource={source()} focusMember="C22" onShowMembers={onShowMembers} /></ProjectProvider>);
  const results = await screen.findByRole('region', { name: 'Resultados' });
  // El cálculo del modelo llega después: la columna elegida queda abierta.
  expect(await within(results).findByRole('heading', { name: /Columna del eje 2, nivel 2/ }, { timeout: 8000 })).toBeTruthy();
  await user.click(within(results).getByRole('button', { name: /Ver en el Modelo/ }));
  expect(onShowMembers).toHaveBeenCalledWith(['C22'], undefined);
  // Otra elección: la viga del nivel 1 devuelve sus dos tramos.
  await user.click(within(within(results).getByRole('table', { name: /Cociente que rige/ })).getByRole('button', { name: /Viga del nivel 1/ }));
  await user.click(within(results).getByRole('button', { name: /Ver en el Modelo/ }));
  expect(onShowMembers).toHaveBeenLastCalledWith(['V11', 'V21'], undefined);
}, 20_000);
