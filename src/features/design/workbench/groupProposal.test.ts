import { expect, it } from 'vitest';
import { concreteFrameGroups, withConcreteSections } from '../../../data/concreteFrame';
import { createConcreteFrameProject } from '../../../data/defaultProject';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, designFromDraft, parseStories } from './frameModel';
import { frameProposalStories, proposeFrameSections, proposeModelSections, type SectionProposal } from './frameProposal';

const codes = ['ntc-2023', 'nsr-10', 'e060'] as const;
const done = (steps: ReturnType<typeof proposeFrameSections>): SectionProposal => {
  const last = [...steps].at(-1)!;
  if (last.kind !== 'done') throw new Error(last.kind === 'failed' ? last.reason : 'incompleta');
  return last.proposal;
};

it.each(codes)('pórtico por nivel con %s: cumple, mínimo local y volumen menor o igual al uniforme', (code) => {
  const draft = { ...FRAME_DEFAULTS, source: 'frame', proposalBars: 'yes' };
  const proposal = done(proposeFrameSections(code, draft, DEFAULT_BAYS, DEFAULT_STORIES));
  const evaluate = (candidate: SectionProposal) => designFromDraft(code, draft, DEFAULT_BAYS, frameProposalStories(DEFAULT_STORIES, candidate));
  expect(proposal.groups).toHaveLength(4);
  expect(proposal.volumeM3).toBeLessThanOrEqual(proposal.uniformVolumeM3! + 1e-9);
  const passing = evaluate(proposal);
  expect(passing.ok && passing.result.status !== 'fail').toBe(true);
  expect(passing.ok && passing.result.governingRatio).toBeCloseTo(proposal.ratio, 10);
  for (const group of proposal.groups!) {
    const reductions = group.kind === 'column' ? [{ width: group.width - 5, height: group.height - 5 }]
      : [{ width: group.width, height: group.height - 5 }, { width: group.width - 5, height: group.height }];
    for (const section of reductions) {
      if (group.kind === 'column' ? section.width < 30 : section.width < 25 || section.height < Math.max(35, section.width) || section.height > 3 * section.width) continue;
      const reduced = evaluate({ ...proposal, groups: proposal.groups!.map((item) => item.id === group.id ? { ...item, ...section } : item) });
      expect(!reduced.ok || reduced.result.status === 'fail' || reduced.result.governingRatio > 1, group.label).toBe(true);
    }
  }
  const saved = frameProposalStories(DEFAULT_STORIES, proposal);
  expect(parseStories(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  expect(parseStories([{ ...saved[0], beamHeight: {} }])).toBeUndefined();
}, 30_000);

it.each(codes)('Modelo 2D por nivel con %s: aplicada conserva las demandas y cumple', (code) => {
  const project = createConcreteFrameProject();
  const groups = concreteFrameGroups(project);
  const draft = { ...FRAME_DEFAULTS, source: 'model', proposalBars: 'yes' };
  const sections = (beam: { width: number; height: number }, column: { width: number; height: number }) => ({
    beam: { widthMm: beam.width * 10, heightMm: beam.height * 10 }, column: { widthMm: column.width * 10, heightMm: column.height * 10 },
  });
  const proposal = done(proposeModelSections(code, draft, {
    groups, beamLengthM: groups.filter((g) => g.kind === 'beam').reduce((sum, g) => sum + g.lengthM, 0),
    columnLengthM: groups.filter((g) => g.kind === 'column').reduce((sum, g) => sum + g.lengthM, 0),
    variant: (beam, column, assigned) => model2dDesignSource(withConcreteSections(project, sections(beam, column), assigned)),
  }));
  const written = withConcreteSections(project, sections(proposal.beam, proposal.column), proposal.groups);
  const evaluate = (assigned = proposal.groups) => designFromDraft(code, draft, [], [], model2dDesignSource(withConcreteSections(project, sections(proposal.beam, proposal.column), assigned)));
  const result = evaluate();
  expect(result.ok && result.result.status !== 'fail').toBe(true);
  expect(result.ok && result.result.governingRatio).toBeCloseTo(proposal.ratio, 10);
  expect(proposal.volumeM3).toBeLessThanOrEqual(proposal.uniformVolumeM3! + 1e-9);
  for (const group of proposal.groups!) {
    const section = group.kind === 'beam' ? { width: group.width, height: group.height - 5 } : { width: group.width - 5, height: group.height - 5 };
    if (group.kind === 'beam' ? section.height < Math.max(35, section.width) : section.width < 30) continue;
    const reduced = evaluate(proposal.groups!.map((g) => g.id === group.id ? { ...g, ...section } : g));
    expect(!reduced.ok || reduced.result.status === 'fail' || reduced.result.governingRatio > 1, group.label).toBe(true);
  }
  expect(written.nodes).toBe(project.nodes);
  expect(written.memberLoads).toBe(project.memberLoads);
  expect(written.nodalLoads).toBe(project.nodalLoads);
}, 60_000);
