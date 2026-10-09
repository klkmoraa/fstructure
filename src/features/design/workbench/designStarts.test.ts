import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '../../../design/elements/beamAnalysis';
import { beamReportFromDraft, beamToInput } from './beamModel';
import { DESIGN_STARTS, type DesignStart } from './designStarts';
import { reportFromMemoryItem } from './designMemory';
import { COLUMN_DEFAULTS } from './columnModel';
import { FOOTING_DEFAULTS } from './footingModel';
import { FRAME_DEFAULTS } from './frameModel';
import { SECTION_DEFAULTS } from './concreteStudioModel';

const byId = (id: string) => {
  const start = DESIGN_STARTS.find((item) => item.id === id);
  if (!start) throw new Error(`Missing start ${id}`);
  return start;
};

describe('design starts', () => {
  it('includes project, piece and exercise starts with independent copies of current defaults', () => {
    expect(new Set(DESIGN_STARTS.map((start) => start.category))).toEqual(new Set(['project', 'piece', 'exercise']));
    expect(byId('project-2d').source).toBe('model');
    expect(byId('project-3d').source).toBe('model3d');
    expect(byId('project-house').category).toBe('project');
    expect(byId('project-building').category).toBe('project');
    for (const start of DESIGN_STARTS) {
      expect(start.title.length).toBeGreaterThan(0);
      expect(start.description.length).toBeGreaterThan(0);
      expect(Object.values(start.fields).every((value) => value.length <= 32)).toBe(true);
    }
    expect(byId('piece-footing').fields).toEqual({ ...FOOTING_DEFAULTS, tag: 'Zapata' });
    expect(byId('piece-beam-simple').rows).toHaveLength(1);
    expect(byId('piece-beam-simple').fields).toMatchObject({ leftEnd: 'pin', rightEnd: 'roller' });
    for (const start of DESIGN_STARTS.filter((item) => item.category === 'piece' && item.element === 'beam')) {
      expect(start.fields.exercise).toBe('');
    }
    expect(byId('piece-column').fields).toEqual({ ...COLUMN_DEFAULTS, tag: 'Columna' });
    expect(byId('piece-section').fields).toEqual({ ...SECTION_DEFAULTS, tag: 'Sección' });
    expect(byId('exercise-frame').fields).toEqual({ ...FRAME_DEFAULTS, source: 'frame', tag: 'Pórtico vivienda' });
  });

  it.each([
    ['exercise-beam-simple', 31.25],
    ['exercise-beam-cantilever', 10],
    ['exercise-beam-point', 10],
  ])('solves %s with its analytic service moment', (id, reference) => {
    const start = byId(id);
    const draft = { ...start.fields };
    const rows = start.rows ?? [];
    const input = beamToInput('ntc-2023', draft as never, rows as never);
    const outcome = analyzeBeam({
      spans: input.spans,
      leftEnd: input.leftEnd,
      rightEnd: input.rightEnd,
      selfWeightKnPerM: 0,
      elasticModulusKpa: 25_000_000,
      areaM2: 0.125,
      inertiaM4: 0.000026,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const moments = outcome.analysis.deadPerSpan.flatMap((caseResult) => caseResult.moment);
    expect(Math.max(...moments.map(Math.abs))).toBeCloseTo(reference, 6);
    expect(beamReportFromDraft('ntc-2023', draft as never, rows as never).ok).toBe(true);
  });

  it('gives the beam exercises the stated loads, supports and no-self-weight hypothesis', () => {
    const simple = byId('exercise-beam-simple');
    expect(simple.fields.exercise).toBe('exercise-beam-simple');
    expect(simple.fields.selfWeight).toBe('no');
    expect(simple.fields.leftEnd).toBe('pin');
    expect(simple.fields.rightEnd).toBe('roller');
    expect(simple.rows?.[0]).toMatchObject({ length: '5', dead: '10', live: '0' });
    expect(simple.reference).toContain('31.25');
    const cantilever = byId('exercise-beam-cantilever');
    expect(cantilever.fields.exercise).toBe('exercise-beam-cantilever');
    expect(cantilever.fields.leftEnd).toBe('fixed');
    expect(cantilever.fields.rightEnd).toBe('free');
    expect(cantilever.rows?.[0]).toMatchObject({ length: '2', dead: '5', live: '0' });
    const point = byId('exercise-beam-point');
    expect(point.fields.exercise).toBe('exercise-beam-point');
    expect(point.fields.points).toBe('yes');
    expect(point.rows?.[0]).toMatchObject({ length: '4', dead: '0', live: '0', pointDead: '10', pointAt: '2' });
  });

  it('exports starts as readonly data with the required public contract', () => {
    const start: DesignStart = byId('exercise-column');
    expect(start.element).toBe('column');
    expect(start.category).toBe('exercise');
  });

  it('sends every editable piece and exercise to its existing engine with valid geometry', () => {
    const recipes = DESIGN_STARTS.filter((start) => start.category !== 'project' || start.fields.source === 'frame');
    for (const [index, start] of recipes.entries()) {
      const outcome = reportFromMemoryItem({
        id: `recipe-${index}`, element: start.element, code: 'ntc-2023', savedAt: '2026-10-01',
        fields: start.fields, ...(start.rows ? { rows: start.rows } : {}), ...(start.levels ? { levels: start.levels } : {}),
      });
      expect(outcome.ok, `${start.id}: ${outcome.ok ? '' : outcome.errors.join('; ')}`).toBe(true);
    }
  });
});
