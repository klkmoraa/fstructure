import { describe, expect, it } from 'vitest';
import { designBeam } from '../../../design/elements/beam';
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
      const checked = designBeam({ ...input, provided: { ...input.provided!, ...candidate.applyFields, top: candidate.applyFields?.topCount ? { count: Number(candidate.applyFields.topCount), diameterMm: Number(candidate.applyFields.topBar) } : input.provided!.top, bottom: candidate.applyFields?.bottomCount ? { count: Number(candidate.applyFields.bottomCount), diameterMm: Number(candidate.applyFields.bottomBar) } : input.provided!.bottom } });
      expect(checked.ok && checked.status !== 'fail').toBe(true);
      expect(candidate.reinforcement.group.diameterMm).toBe(15.9);
    }
  });
});
