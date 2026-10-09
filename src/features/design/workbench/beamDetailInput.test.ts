import { describe, expect, it } from 'vitest';
import { parseBeamDetails } from './beamDetailInput';
import { EMPTY_BEAM_DETAILS } from './beamDetailDraft';

const spans = [{ length: '5', dead: '0', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }];

describe('parseBeamDetails', () => {
  it('maps general loads and physical reinforcement regions to engine geometry', () => {
    const parsed = parseBeamDetails({
      ...EMPTY_BEAM_DETAILS,
      loads: [
        { id: 'q1', span: '1', kind: 'distributed', category: 'dead', start: '0', end: '1', startValue: '4', endValue: '4' },
        { id: 'p1', span: '1', kind: 'point', category: 'live', start: '3', end: '', startValue: '10', endValue: '' },
      ],
      bastions: [{ id: 'b1', bed: 'top', count: '2', diameterMm: '15.9', startM: '1', endM: '2' }],
      stirrupZones: [{ span: '1', endSpacingMm: '100', endLengthM: '.6', centerSpacingMm: '200' }],
    }, spans);
    expect(parsed.errors).toEqual([]);
    expect(parsed.loads).toEqual([
      { spanIndex: 0, category: 'dead', kind: 'distributed', startM: 0, endM: 1, startKn: 4, endKn: 4 },
      { spanIndex: 0, category: 'live', kind: 'point', startM: 3, endM: 3, startKn: 10, endKn: 10 },
    ]);
    expect(parsed.bastions).toEqual([{ bed: 'top', count: 2, diameterMm: 15.9, startM: 1, endM: 2 }]);
    expect(parsed.stirrupZones).toEqual([{ endSpacingMm: 100, endLengthM: .6, centerSpacingMm: 200 }]);
  });

  it('keeps blanks, non-finite numbers, outside positions, overlap and span mismatch invalid', () => {
    const invalid = parseBeamDetails({
      ...EMPTY_BEAM_DETAILS,
      loads: [{ id: 'q1', span: '1', kind: 'distributed', category: 'dead', start: '0', end: '6', startValue: 'Infinity', endValue: '' }],
      bastions: [
        { id: 'b1', bed: 'top', count: '2', diameterMm: '15.9', startM: '1', endM: '3' },
        { id: 'b2', bed: 'top', count: '2', diameterMm: '15.9', startM: '2', endM: '4' },
      ],
      stirrupZones: [{ span: '2', endSpacingMm: '100', endLengthM: '.6', centerSpacingMm: '200' }],
    }, spans);
    expect(invalid.errors.join(' ')).toMatch(/carga|bastones|claro/i);
    expect(invalid.loads).toEqual([]);
    expect(invalid.bastions).toEqual([]);
  });
});
