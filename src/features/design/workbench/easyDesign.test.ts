import { describe, expect, it } from 'vitest';
import { designBeam } from '../../../design/elements/beam';
import { designColumn } from '../../../design/elements/column';
import { BEAM_DEFAULTS, DEFAULT_SPANS, beamToInput, proposeBeamSection, slabLineLoads } from './beamModel';
import { COLUMN_DEFAULTS, columnToInput, proposeColumn, proposeColumnSection } from './columnModel';
import { reportFromMemoryItem } from './designMemory';
import { EMPTY_BEAM_DETAILS } from './beamDetailDraft';
import { FOOTING_DEFAULTS, footingReportFromDraft } from './footingModel';

describe('diseño más fácil', () => {
  it('convierte la losa en carga de línea: ancho tributario por carga más muros', () => {
    expect(slabLineLoads({ ...BEAM_DEFAULTS, tributary: '3.5', slabDead: '4.8', slabLive: '1.9', wallLoad: '6' })).toEqual({ dead: 22.8, live: 6.65 });
    expect(slabLineLoads({ ...BEAM_DEFAULTS, tributary: '0' })).toBeNull();
  });

  it('propone la viga de menor área que cumple y la anterior (5 cm menos) no cumple', () => {
    const spans = [{ ...DEFAULT_SPANS[0]!, length: '7', dead: '25', live: '12' }, DEFAULT_SPANS[1]!];
    const proposal = proposeBeamSection('ntc-2023', BEAM_DEFAULTS, spans)!;
    const trial = (width: string, height: string) => designBeam(beamToInput('ntc-2023', { ...BEAM_DEFAULTS, width, height }, spans, false));
    const chosen = trial(proposal.width, proposal.height);
    expect(chosen.ok && chosen.status).not.toBe('fail');
    const shallower = trial(proposal.width, String(Number(proposal.height) - 5));
    expect(!shallower.ok || shallower.status === 'fail').toBe(true);
    expect(Number(proposal.height)).toBeLessThanOrEqual(3 * Number(proposal.width));
  });

  it('considera las cargas adicionales al proponer sección y bloquea borradores incompletos', () => {
    const spans = [{ ...DEFAULT_SPANS[0]!, length: '5', dead: '0', live: '0' }];
    const load = { ...EMPTY_BEAM_DETAILS, loads: [{ id: 'p1', span: '1', kind: 'point' as const, category: 'dead' as const, start: '2.5', end: '', startValue: '30', endValue: '' }] };
    const baseline = proposeBeamSection('ntc-2023', BEAM_DEFAULTS, spans)!;
    const withLoad = proposeBeamSection('ntc-2023', BEAM_DEFAULTS, spans, load);
    expect(withLoad).not.toBeNull();
    expect(withLoad).not.toEqual(baseline);
    const incomplete = { ...EMPTY_BEAM_DETAILS, loads: [{ id: 'q1', span: '1', kind: 'point' as const, category: 'live' as const, start: '', end: '', startValue: '', endValue: '' }] };
    expect(proposeBeamSection('ntc-2023', BEAM_DEFAULTS, spans, incomplete)).toBeNull();
  });

  it('propone sección y armado de columna rectangular y circular que cumplen', () => {
    for (const shape of ['rectangular', 'circular']) {
      const draft = { ...COLUMN_DEFAULTS, shape, axial: '2500', momentX: '150', momentY: '80' };
      const proposal = proposeColumn('ntc-2023', draft)!;
      const result = designColumn(columnToInput('ntc-2023', { ...draft, ...proposal }));
      expect(result.ok && result.status).not.toBe('fail');
      if (result.ok) expect(result.steelRatio).toBeLessThanOrEqual(0.025 + 1e-9);
    }
  });

  it('la memoria del proyecto recalcula zapatas corridas y combinadas', () => {
    const strip = reportFromMemoryItem({ id: 's1', element: 'footing', code: 'ntc-2023', savedAt: '', fields: { type: 'strip', tag: 'ZC-1' } });
    const combined = reportFromMemoryItem({ id: 'c1', element: 'footing', code: 'nsr-10', savedAt: '', fields: { type: 'combined', tag: 'ZK-1' } });
    expect(strip.ok && strip.report.title).toMatch(/^Zapata corrida/);
    expect(combined.ok && combined.report.title).toMatch(/^Zapata combinada/);
    const isolated = footingReportFromDraft('ntc-2023', FOOTING_DEFAULTS);
    expect(isolated.ok && isolated.report.title).toMatch(/^Zapata \d/);
  });
});

describe('proposeColumnSection', () => {
  it('da la menor sección que cumple con el armado capturado', () => {
    const fields = proposeColumnSection('ntc-2023', COLUMN_DEFAULTS)!;
    const result = designColumn(columnToInput('ntc-2023', { ...COLUMN_DEFAULTS, ...fields }));
    expect(result.ok && result.status).not.toBe('fail');
    const smaller = String(Number(fields.width) - 5);
    const below = designColumn(columnToInput('ntc-2023', { ...COLUMN_DEFAULTS, width: smaller, depth: smaller }));
    expect(below.ok && below.status).toBe('fail');
  });

  it('sin sección que cumpla con ese armado devuelve null', () => {
    expect(proposeColumnSection('ntc-2023', { ...COLUMN_DEFAULTS, axial: '40000' })).toBeNull();
  });
});
