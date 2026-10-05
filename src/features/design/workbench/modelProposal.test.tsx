// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { concreteFrameMembers, withConcreteSections } from '../../../data/concreteFrame';
import { createConcreteFrameProject, createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { ProjectProvider } from '../../../store/ProjectContext';
import type { ProjectModel } from '../../../types';
import { DesignWorkbench } from './DesignWorkbench';
import { FRAME_DEFAULTS, designFromDraft } from './frameModel';
import { proposeModelSections } from './frameProposal';
import type { ModelSection, ModelSectionsBridge } from './WorkbenchLayout';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const mm = (beam: ModelSection, column: ModelSection) => ({ beam: { widthMm: beam.width * 10, heightMm: beam.height * 10 }, column: { widthMm: column.width * 10, heightMm: column.height * 10 } });
const bridgeOf = (project: ProjectModel, apply: ModelSectionsBridge['apply'] = () => undefined): ModelSectionsBridge => {
  const { beams, columns } = concreteFrameMembers(project);
  const sum = (items: readonly { lengthM: number }[]) => items.reduce((total, item) => total + item.lengthM, 0);
  return {
    beams: beams.length, columns: columns.length, beamLengthM: sum(beams), columnLengthM: sum(columns),
    volumeM3: [...beams, ...columns].reduce((total, item) => total + item.lengthM * item.areaM2, 0),
    variant: (beam, column) => model2dDesignSource(withConcreteSections(project, mm(beam, column))),
    apply,
  };
};

it('reconoce las vigas y columnas de concreto y les pone una sección sin tocar lo demás', () => {
  const project = createConcreteFrameProject();
  const { beams, columns } = concreteFrameMembers(project);
  expect(beams.map((item) => item.id).sort()).toEqual(['V11', 'V12', 'V21', 'V22']);
  expect(columns).toHaveLength(6);
  expect(beams.reduce((total, item) => total + item.lengthM, 0)).toBeCloseTo(22, 9);
  // Una barra de acero agregada no es de concreto: no cambia.
  const steel = { ...project.members[0]!, id: 'S1', materialId: undefined, E: 200e6, A: 0.005, I: 8e-6 };
  const next = withConcreteSections({ ...project, members: [...project.members, steel] }, { beam: { widthMm: 300, heightMm: 500 }, column: { widthMm: 400, heightMm: 400 } });
  const v11 = next.members.find((member) => member.id === 'V11')!;
  expect(v11.A).toBeCloseTo(0.15, 12);
  expect(v11.I).toBeCloseTo(0.3 * 0.5 ** 3 / 12, 12);
  expect(next.members.find((member) => member.id === 'C11')!.A).toBeCloseTo(0.16, 12);
  expect(next.members.find((member) => member.id === 'S1')).toEqual(steel);
  // El material y la densidad (peso propio) de cada barra se conservan.
  expect(v11.materialId).toBe(project.members.find((member) => member.id === 'V11')!.materialId);
  expect(v11.density).toBe(project.members.find((member) => member.id === 'V11')!.density);
});

it('la propuesta para el Modelo 2D cumple al escribirla en el modelo', () => {
  const project = createConcreteFrameProject();
  const draft = { ...FRAME_DEFAULTS, source: 'model' };
  const last = [...proposeModelSections('nsr-10', draft, bridgeOf(project))].at(-1)!;
  if (last.kind !== 'done') throw new Error(last.kind === 'failed' ? last.reason : 'sin terminar');
  const { beam, column } = last.proposal;
  const written = withConcreteSections(project, mm(beam, column));
  const bars = String(column.barsPerFace);
  const outcome = designFromDraft('nsr-10', { ...draft, barsWidth: bars, barsDepth: bars }, [], [], model2dDesignSource(written));
  if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
  expect(outcome.result.status).not.toBe('fail');
  expect(outcome.result.governingRatio).toBeCloseTo(last.proposal.ratio, 12);
});

it('Estructura muestra la propuesta y la escribe en el modelo sólo al aplicarla', async () => {
  const user = userEvent.setup();
  const project = createConcreteFrameProject();
  const apply = vi.fn();
  render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="model" modelSource={model2dDesignSource(project)} modelSections={bridgeOf(project, apply)} /></ProjectProvider>);
  expect(screen.getByText(/4 vigas y 6 columnas de concreto/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Proponer' }));
  const applyButton = await screen.findByRole('button', { name: 'Aplicar al modelo' }, { timeout: 15_000 });
  expect(apply).not.toHaveBeenCalled();
  await user.click(applyButton);
  expect(apply).toHaveBeenCalledTimes(1);
  const [beam, column] = apply.mock.calls[0]!;
  expect(beam.width).toBeGreaterThanOrEqual(25);
  expect(column.width).toBeGreaterThanOrEqual(30);
  expect(screen.getByText(/Deshacer en el modo 2D recupera las secciones anteriores/)).toBeTruthy();
}, 30_000);
