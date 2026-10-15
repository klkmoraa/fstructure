import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, designFromDraft, frameModelSpec, parseStories, pointsOfStories, storiesWithPoints, storiesWithoutBay,
  storyWithoutPoints, uniformStory, type FrameDraft, type StoryDraft,
} from './frameCalculation';
import { frameConcreteVolume } from './frameProposal';
import { frameReportFromDraft } from './frameModel';

const draft: FrameDraft = { ...FRAME_DEFAULTS, source: 'frame' };

describe('cargas puntuales y voladizos del pórtico rápido', () => {
  it('las cargas puntuales viajan en el renglón de su nivel y vuelven igual', () => {
    const points = [
      { level: 0, bay: 0, at: '2', dead: '30', live: '15' },
      { level: 1, bay: 1, at: '1.25', dead: '12', live: '0' },
      { level: 0, bay: 1, at: '3', dead: '5', live: '5' },
    ];
    const stories = storiesWithPoints(DEFAULT_STORIES, points);
    expect(stories[0]).toMatchObject({ p1: '0|2|30|15', p2: '1|3|5|5' });
    expect(stories[1]).toMatchObject({ p1: '1|1.25|12|0' });
    // Guardado y leído como cualquier nivel: cada campo cabe en 32 caracteres.
    expect(parseStories(JSON.parse(JSON.stringify(stories)))).toEqual(stories);
    expect(pointsOfStories(stories)).toEqual([points[0], points[2], points[1]]);
  });

  it('un borrador guardado antes (sin cargas puntuales ni voladizos) se diseña igual que siempre', () => {
    const legacyStories = parseStories(JSON.parse(JSON.stringify(DEFAULT_STORIES)))!;
    expect(pointsOfStories(legacyStories)).toEqual([]);
    const legacyDraft = Object.fromEntries(Object.entries(draft).filter(([key]) => !key.startsWith('cant'))) as Partial<FrameDraft>;
    const before = designFromDraft('ntc-2023', { ...FRAME_DEFAULTS, ...legacyDraft } as FrameDraft, DEFAULT_BAYS, legacyStories);
    const now = designFromDraft('ntc-2023', draft, DEFAULT_BAYS, storiesWithPoints(DEFAULT_STORIES, []));
    if (!before.ok || !now.ok) throw new Error('sin diseño');
    expect(now.result.governingRatio).toBe(before.result.governingRatio);
    expect(now.result.members).toHaveLength(before.result.members.length);
    expect(now.frame?.input.cantilevers).toBeUndefined();
  });

  it('quitar un claro quita sus cargas y recorre las siguientes; un nivel nuevo no las copia', () => {
    const stories = storiesWithPoints(DEFAULT_STORIES, [
      { level: 0, bay: 0, at: '2', dead: '30', live: '15' },
      { level: 0, bay: 1, at: '1', dead: '10', live: '5' },
    ]);
    expect(pointsOfStories(storiesWithoutBay(stories, 0))).toEqual([{ level: 0, bay: 0, at: '1', dead: '10', live: '5' }]);
    expect(pointsOfStories([storyWithoutPoints(stories[0]!)])).toEqual([]);
    // Volver a secciones uniformes conserva las cargas.
    const sectioned: StoryDraft = { ...stories[0]!, beamWidth: '25', beamHeight: '50' };
    expect(uniformStory(sectioned)).toEqual(stories[0]);
  });

  it('diseña el pórtico con carga puntual y voladizo, y lo lleva igual al Modelo 2D y a la memoria', () => {
    const withLoads: FrameDraft = { ...draft, cantRight: '1.5', cantDead: '12', cantLive: '4', cantTipDead: '8', cantTipLive: '2' };
    const stories = storiesWithPoints(DEFAULT_STORIES, [{ level: 0, bay: 0, at: '2', dead: '30', live: '15' }]);
    const outcome = designFromDraft('ntc-2023', withLoads, DEFAULT_BAYS, stories);
    if (!outcome.ok) throw new Error(outcome.errors.join(' '));
    expect(outcome.frame?.input.cantilevers?.right).toEqual({ lengthM: 1.5, deadKnPerM: 12, liveKnPerM: 4, tipDeadKn: 8, tipLiveKn: 2 });
    expect(outcome.result.beams.every((beam) => beam.result.input.rightEnd === 'free')).toBe(true);
    expect(outcome.result.members.find((member) => member.id === 'V1-1')?.points).toEqual([{ atM: 2, deadKn: 30, liveKn: 15 }]);
    const spec = frameModelSpec('ntc-2023', withLoads, DEFAULT_BAYS, stories);
    expect(spec.cantilevers?.right?.lengthM).toBe(1.5);
    expect(spec.stories[0]!.pointLoads).toEqual([{ bay: 0, atM: 2, deadKn: 30, liveKn: 15 }]);
    const memory = frameReportFromDraft('ntc-2023', withLoads, DEFAULT_BAYS, stories);
    expect(memory.ok && memory.report.title).toContain('voladizo der. · 1 carga puntual');
    expect(frameConcreteVolume(withLoads, DEFAULT_BAYS, DEFAULT_STORIES)).toBeGreaterThan(frameConcreteVolume(draft, DEFAULT_BAYS, DEFAULT_STORIES));
  });

  it('una carga fuera del claro o negativa se reporta sin lanzar', () => {
    const outside = designFromDraft('ntc-2023', draft, DEFAULT_BAYS, storiesWithPoints(DEFAULT_STORIES, [{ level: 0, bay: 1, at: '7', dead: '10', live: '0' }]));
    expect(outside.ok).toBe(false);
    expect(!outside.ok && outside.errors.join(' ')).toContain('dentro del claro (0 a 4 m)');
    const negative = designFromDraft('ntc-2023', { ...draft, cantLeft: '1', cantDead: '-2' }, DEFAULT_BAYS, DEFAULT_STORIES);
    expect(!negative.ok && negative.errors.join(' ')).toContain('Voladizo izquierdo');
  });
});
