import { describe, expect, it } from 'vitest';
import { designBeam } from '../../../design/elements/beam';
import { designColumn } from '../../../design/elements/column';
import { BEAM_DEFAULTS, DEFAULT_SPANS, beamToInput, proposeBeamSection, slabLineLoads } from './beamModel';
import { COLUMN_DEFAULTS, columnToInput, proposeColumn } from './columnModel';
import { reportFromMemoryItem } from './designMemory';
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
