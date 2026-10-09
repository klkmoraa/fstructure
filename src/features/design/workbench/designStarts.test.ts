import { describe, expect, it } from 'vitest';
import { DESIGN_STARTS, type DesignStart } from './designStarts';
import { reportFromMemoryItem } from './designMemory';
import { COLUMN_DEFAULTS } from './columnModel';
import { FOOTING_DEFAULTS } from './footingModel';
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
    expect(byId('problem-beam').fields.exercise).toBe('');
  });

  it('starts the three own-form exercises incomplete and without resolved examples', () => {
    const section = byId('problem-section');
    const column = byId('problem-column');
    const beam = byId('problem-beam');
    expect(section.title).toBe('Sección con acciones dadas');
    expect(section.fields).toMatchObject({ preset: 'custom', shape: 'rectangle', barLayout: 'layers', tag: '', axial: '', moment: '', width: '', height: '', cover: '', fc: '', fy: '', exercise: '' });
    expect(column.title).toBe('Columna con acciones dadas');
    expect(column.fields).toMatchObject({ shape: 'rectangular', tag: '', width: '', depth: '', cover: '', fc: '', fy: '', axial: '', momentX: '', momentY: '' });
    expect(beam.title).toBe('Viga con claros y cargas');
    expect(beam.fields).toMatchObject({ tag: '', sectionType: 'rect', leftEnd: 'pin', rightEnd: 'roller', width: '', height: '', cover: '', fc: '', fy: '', exercise: '' });
    expect(beam.rows).toEqual([expect.objectContaining({ length: '', dead: '', live: '' })]);
    expect(DESIGN_STARTS.filter((start) => start.category === 'exercise').map((start) => start.id)).toEqual(['problem-section', 'problem-column', 'problem-beam']);
    for (const start of [section, column, beam]) expect(reportFromMemoryItem({ id: start.id, element: start.element, code: 'ntc-2023', savedAt: '2026-10-01', fields: start.fields, ...(start.rows ? { rows: start.rows } : {}) }).ok).toBe(false);
  });

  it('exports starts as readonly data with the required public contract', () => {
    const start: DesignStart = byId('problem-column');
    expect(start.element).toBe('column');
    expect(start.category).toBe('exercise');
  });

  it('sends every editable piece and exercise to its existing engine with valid geometry', () => {
    const recipes = DESIGN_STARTS.filter((start) => start.category === 'piece' || (start.category === 'project' && start.fields.source === 'frame'));
    for (const [index, start] of recipes.entries()) {
      const outcome = reportFromMemoryItem({
        id: `recipe-${index}`, element: start.element, code: 'ntc-2023', savedAt: '2026-10-01',
        fields: start.fields, ...(start.rows ? { rows: start.rows } : {}), ...(start.levels ? { levels: start.levels } : {}),
      });
      expect(outcome.ok, `${start.id}: ${outcome.ok ? '' : outcome.errors.join('; ')}`).toBe(true);
    }
  });
});
