import { describe, expect, it } from 'vitest';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, designFromDraft, type FrameDraft } from './frameModel';
import { columnBarsPerFace, proposeFrameSections, type ProposalStep } from './frameProposal';

const draft: FrameDraft = { ...FRAME_DEFAULTS, source: 'frame' };
const run = (code: 'ntc-2023' | 'nsr-10' | 'e060', base = draft, bays = DEFAULT_BAYS, stories = DEFAULT_STORIES) => {
  const steps: ProposalStep[] = [...proposeFrameSections(code, base, bays, stories)];
  return { steps, last: steps.at(-1)! };
};
const ratioWith = (code: 'ntc-2023' | 'nsr-10' | 'e060', beam: [number, number], column: number) => {
  const bars = String(columnBarsPerFace(column, Number(draft.columnBar)));
  const outcome = designFromDraft(code, { ...draft, beamWidth: String(beam[0]), beamHeight: String(beam[1]), columnWidth: String(column), columnHeight: String(column), barsWidth: bars, barsDepth: bars }, DEFAULT_BAYS, DEFAULT_STORIES);
  if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
  return { ratio: outcome.result.governingRatio, status: outcome.result.status };
};

describe('proponer secciones del pórtico rápido', () => {
  it.each(['ntc-2023', 'nsr-10', 'e060'] as const)('con %s encuentra secciones que cumplen y un paso menos ya no cumple', (code) => {
    const started = performance.now();
    const { steps, last } = run(code);
    if (last.kind !== 'done') throw new Error(last.kind === 'failed' ? last.reason : 'sin terminar');
    const { beam, column, ratio, trials } = last.proposal;
    // Un paso por diseño: lo que reporta es lo que intentó.
    expect(steps.filter((step) => step.kind === 'trying')).toHaveLength(trials);
    expect(ratio).toBeLessThanOrEqual(1);
    const passing = ratioWith(code, [beam.width, beam.height], column.width);
    expect(passing.status).not.toBe('fail');
    expect(passing.ratio).toBeCloseTo(ratio, 12);
    // Mínima en su vecindad: quitar 5 cm a la viga o a la columna ya no cumple.
    const fails = (candidate: { ratio: number; status: string }) => candidate.ratio > 1 || candidate.status === 'fail';
    if (beam.height > Math.max(35, beam.width)) expect(fails(ratioWith(code, [beam.width, beam.height - 5], column.width))).toBe(true);
    if (column.width > 30) expect(fails(ratioWith(code, [beam.width, beam.height], column.width - 5))).toBe(true);
    // La columna lleva al menos 1 % de cuantía con la varilla del borrador.
    const bar = Math.PI * (Number(draft.columnBar) / 10) ** 2 / 4;
    expect(4 * (column.barsPerFace - 1) * bar / column.width ** 2).toBeGreaterThanOrEqual(0.01);
    // No gasta más concreto que las secciones del ejemplo (30×55 y 45×45, que cumplen).
    const beamLength = 9 * 2;
    const columnLength = 6.5 * 3;
    expect(last.proposal.volumeM3).toBeLessThanOrEqual((beamLength * 30 * 55 + columnLength * 45 * 45) / 1e4 + 1e-9);
    expect(performance.now() - started).toBeLessThan(10_000);
  });

  it('las cargas mayores piden más concreto', () => {
    const light = run('nsr-10').last;
    const heavy = run('nsr-10', draft, DEFAULT_BAYS, DEFAULT_STORIES.map((story) => ({ ...story, dead: String(Number(story.dead) * 2), live: String(Number(story.live) * 2) }))).last;
    if (light.kind !== 'done' || heavy.kind !== 'done') throw new Error('sin propuesta');
    expect(heavy.proposal.volumeM3).toBeGreaterThan(light.proposal.volumeM3);
  });

  it('dice por qué no puede proponer', () => {
    const { last } = run('nsr-10', { ...draft, fc: 'abc' });
    expect(last.kind).toBe('failed');
  });
});
