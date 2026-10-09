import { describe, expect, it } from 'vitest';
import { BEAM_DEFAULTS, beamSupportPreset, beamToInput, DEFAULT_SPANS } from './beamModel';
import { EMPTY_BEAM_DETAILS } from './beamDetailDraft';

describe('beamSupportPreset', () => {
  it('cambia los apoyos y duplica el claro existente sólo al hacer continua una viga simple', () => {
    const one = [{ ...DEFAULT_SPANS[0]!, dead: '37', live: '12', pointDead: '9' }];
    const continuous = beamSupportPreset('continuous', BEAM_DEFAULTS, one);
    expect(continuous.draft).toMatchObject({ leftEnd: 'pin', rightEnd: 'pin' });
    expect(continuous.spans).toEqual([one[0], one[0]]);
    expect(continuous.spans[0]).not.toBe(continuous.spans[1]);

    const alreadyContinuous = beamSupportPreset('fixed', BEAM_DEFAULTS, DEFAULT_SPANS);
    expect(alreadyContinuous.spans).toEqual(DEFAULT_SPANS);
    expect(alreadyContinuous.draft).toMatchObject({ leftEnd: 'fixed', rightEnd: 'fixed' });
  });
});

describe('beamToInput physical details', () => {
  it('adapts general loads, custom bastions and clear-specific stirrup regions', () => {
    const details = {
      ...EMPTY_BEAM_DETAILS,
      loads: [
        { id: 'q1', span: '1', kind: 'distributed' as const, category: 'dead' as const, start: '0', end: '1', startValue: '4', endValue: '4' },
        { id: 'p1', span: '1', kind: 'point' as const, category: 'live' as const, start: '3', end: '', startValue: '10', endValue: '' },
      ],
      bastions: [{ id: 'b1', bed: 'top' as const, count: '2', diameterMm: '15.9', startM: '1', endM: '2' }],
      stirrupZones: [{ span: '1', endSpacingMm: '100', endLengthM: '.6', centerSpacingMm: '200' }],
    };
    const input = beamToInput('ntc-2023', { ...BEAM_DEFAULTS, rebarMode: 'own', ownBastions: 'custom' }, DEFAULT_SPANS.slice(0, 1), true, details);
    expect(input.extraLoads).toEqual([
      { spanIndex: 0, category: 'dead', kind: 'distributed', startM: 0, endM: 1, startKn: 4, endKn: 4 },
      { spanIndex: 0, category: 'live', kind: 'point', startM: 3, endM: 3, startKn: 10, endKn: 10 },
    ]);
    expect(input.provided).toMatchObject({ bastions: 'custom', customBastions: [{ bed: 'top', count: 2, diameterMm: 15.9, startM: 1, endM: 2 }], stirrupZones: [{ endSpacingMm: 100, endLengthM: .6, centerSpacingMm: 200 }] });
  });
});
