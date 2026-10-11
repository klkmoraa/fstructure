import { expect, it } from 'vitest';
import { concreteFrameGroups, withConcreteSections } from '../../../data/concreteFrame';
import { createConcreteFrameProject } from '../../../data/defaultProject';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { FRAME_DEFAULTS, designFromDraft } from '../../design/workbench/frameCalculation';
import { runModelSectionProposal } from './modelSectionProposalTask';

it('propone un grupo del Modelo 2D con el borrador parcial guardado y conserva el alcance al validar todo el modelo', () => {
  const model = createConcreteFrameProject();
  const group = concreteFrameGroups(model).find((item) => item.kind === 'beam')!;
  // Un borrador v8 puede seguir en la fuente de pórtico rápido mientras la
  // persona usa el navegador para proponer sobre el grupo nativo seleccionado.
  // El worker debe tomar la fuente del modelo del request, no de este campo.
  const draft = { ...FRAME_DEFAULTS, source: 'frame', braced: 'yes', proposalBars: 'yes' };
  const steps: Parameters<Parameters<typeof runModelSectionProposal>[1]>[0][] = [];

  runModelSectionProposal({ kind: 'model2d', model, code: 'ntc-2023', draft, scopeMemberIds: group.memberIds }, (step) => steps.push(step));

  const last = steps.at(-1)!;
  expect(last.kind).toBe('done');
  if (last.kind !== 'done') return;
  const proposal = last.proposal;
  const mm = (width: number, height: number) => ({ widthMm: width * 10, heightMm: height * 10 });
  const candidate = withConcreteSections(model, { beam: mm(proposal.beam.width, proposal.beam.height), column: mm(proposal.column.width, proposal.column.height) }, proposal.groups, group.memberIds);
  const beforeOutside = model.members.filter((member) => !group.memberIds.includes(member.id));
  for (const member of beforeOutside) expect(candidate.members.find((next) => next.id === member.id)).toEqual(member);

  const outcome = designFromDraft('ntc-2023', { ...draft, source: 'model' }, [], [], model2dDesignSource(candidate));
  expect(outcome.ok).toBe(true);
  if (outcome.ok) {
    expect(outcome.result.status).not.toBe('fail');
    expect(outcome.result.governingRatio).toBeCloseTo(proposal.ratio, 10);
  }
}, 60_000);
