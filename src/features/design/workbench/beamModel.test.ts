import { describe, expect, it } from 'vitest';
import { BEAM_DEFAULTS, beamSupportPreset, DEFAULT_SPANS } from './beamModel';

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
