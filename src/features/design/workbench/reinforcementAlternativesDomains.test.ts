import { describe, expect, it } from 'vitest';
import { designBeam } from '../../../design/elements/beam';
import { layoutBeamBed } from '../../../design/elements/beamBarLayout';
import { BEAM_DEFAULTS, beamToInput, type SpanDraft } from './beamModel';
import { reinforcementAlternatives } from '../../../design/elements/reinforcementAlternatives';

describe('alternativas de viga', () => {
  it('conserva sección, cargas y detalle y vuelve a evaluar cada candidato con el motor de viga', () => {
    const draft = { ...BEAM_DEFAULTS, width: '40', height: '100', cover: '3', fc: '300', fy: '4200', rebarMode: 'own', ownBastions: 'none', selfWeight: 'no', topCount: '4', bottomCount: '4' };
    const spans: SpanDraft[] = [{ length: '5', dead: '0.2', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }];
    const input = beamToInput('ntc-2023', draft, spans, true);
    const response = reinforcementAlternatives({ kind: 'beam', requestId: 7, input, objective: 'available-bars', availableDiametersMm: [15.9] });
    expect(response.candidates.length).toBeGreaterThan(0);
    expect(response.candidates.length).toBeLessThanOrEqual(3);
    for (const candidate of response.candidates) {
      expect(candidate.geometry).toEqual({ widthMm: input.widthMm, heightMm: input.heightMm });
      expect(candidate.arrangement.shape).toBe('rectangle');
      expect(candidate.arrangement.distribution).toBe('beam-beds');
      expect(candidate.arrangement.beds).toEqual(['top', 'bottom']);
      expect(candidate.arrangement.bars.length).toBeGreaterThan(0);
      expect(candidate.arrangement.bars.every((bar) => Number.isFinite(bar.xMm) && Number.isFinite(bar.yMm) && bar.layer !== undefined)).toBe(true);
      expect(candidate.arrangement.spacingByBed).toHaveLength(2);
      expect(candidate.arrangement.spacingByBed!.every((spacing) => (spacing.clearSpacingMm ?? 0) >= spacing.requiredClearSpacingMm)).toBe(true);
      const checked = designBeam({ ...input, provided: { ...input.provided!, ...candidate.applyFields, top: candidate.applyFields?.topCount ? { count: Number(candidate.applyFields.topCount), diameterMm: Number(candidate.applyFields.topBar) } : input.provided!.top, bottom: candidate.applyFields?.bottomCount ? { count: Number(candidate.applyFields.bottomCount), diameterMm: Number(candidate.applyFields.bottomBar) } : input.provided!.bottom } });
      expect(checked.ok && checked.status !== 'fail').toBe(true);
      if (!checked.ok) continue;
      for (const bed of ['top', 'bottom'] as const) {
        const section = bed === 'top' ? checked.continuousTop : checked.continuousBottom;
        const expectedLayout = layoutBeamBed({ widthMm: input.widthMm, heightMm: input.heightMm, coverMm: input.coverMm, stirrupDiameterMm: checked.stirrupDiameterMm,
          minimumClearSpacingMm: section.minimumClearSpacingMm, continuous: section.continuous, extra: section.extra })!;
        expect(candidate.arrangement.bars.filter((bar) => bar.bed === bed).map((bar) => bar.xMm)).toEqual(expectedLayout.map((bar) => bar.xMm - input.widthMm / 2));
      }
      expect(candidate.reinforcement.group.diameterMm).toBe(15.9);
    }
  });

  it('ordena por diámetros longitudinales aplicados antes que por área, incluyendo el lecho conservado', () => {
    const draft = { ...BEAM_DEFAULTS, width: '40', height: '100', cover: '3', fc: '300', fy: '4200', rebarMode: 'own', ownBastions: 'none', selfWeight: 'no', topCount: '4', topBar: '25.4', bottomCount: '4', bottomBar: '25.4' };
    const spans: SpanDraft[] = [{ length: '5', dead: '0.2', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }];
    const base = beamToInput('ntc-2023', draft, spans, true);
    const input = { ...base, provided: { ...base.provided!, bastions: 'custom' as const, customBastions: [{ bed: 'top' as const, count: 2, diameterMm: 9.5, startM: 0, endM: 2 }] } };
    const request = { kind: 'beam' as const, requestId: 9, input, objective: 'few-diameters' as const, availableDiametersMm: [15.9, 25.4] };
    const minimum = reinforcementAlternatives({ ...request, objective: 'minimum-steel' });
    const few = reinforcementAlternatives(request);
    const variety = (candidate: typeof few.candidates[number]) => new Set(candidate.arrangement.longitudinalDiametersMm).size;
    expect(few.candidates[0]).toBeDefined();
    expect(variety(few.candidates[0]!)).toBe(2);
    expect(variety(minimum.candidates[0]!)).toBeGreaterThan(2);
    expect(few.candidates[0]!.steelAreaMm2).toBeGreaterThan(minimum.candidates[0]!.steelAreaMm2);
    expect(few.candidates[0]!.arrangement.longitudinalRuns).toContainEqual(expect.objectContaining({ diameterMm: 9.5, count: 2 }));
  });

  it('limita las propuestas de viga al catálogo editable y conserva un stock insuficiente sin ampliarlo', () => {
    const draft = { ...BEAM_DEFAULTS, width: '30', height: '55', cover: '3', fc: '250', fy: '4200', rebarMode: 'own', ownBastions: 'none', selfWeight: 'no', topCount: '2', topBar: '15.9', bottomCount: '3', bottomBar: '15.9' };
    const spans: SpanDraft[] = [{ length: '5', dead: '4', live: '1', pointDead: '0', pointLive: '0', pointAt: '2.5' }];
    const input = beamToInput('ntc-2023', draft, spans, true);
    const allCatalog = reinforcementAlternatives({ kind: 'beam', requestId: 10, input, objective: 'minimum-steel' });
    expect(allCatalog.candidates.length).toBeGreaterThan(0);
    expect(allCatalog.candidates.every((candidate) => Number(candidate.applyFields?.topBar ?? candidate.applyFields?.bottomBar) >= 12.7)).toBe(true);
    const limitedStock = reinforcementAlternatives({ kind: 'beam', requestId: 11, input, objective: 'available-bars', availableDiametersMm: [7.9, 9.5] });
    expect(limitedStock.candidates).toEqual([]);
    expect(limitedStock.reason).toBe('no-feasible-candidate');
  });
});
