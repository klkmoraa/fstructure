import { describe, expect, it } from 'vitest';

import {
  ALL_UNIT_LABELS,
  formatDisplay,
  unitLabel,
  unitSystemLabel,
  UNIT_SYSTEM_PROFILES,
} from './units';
import {
  createCustomUnitSystemId,
  fromDisplay,
  isUnitSystemId,
  parseCustomUnitSystemId,
  toDisplay,
  UNIT_QUANTITIES,
  UNIT_SYSTEM_IDS,
} from '../foundation/units';

describe('unit profiles', () => {
  it('round-trips custom T/M-style profiles without changing stored base values', () => {
    const system = createCustomUnitSystemId('T/M', 't', 'm');
    expect(parseCustomUnitSystemId(system)).toEqual({ name: 'T/M', force: 't', length: 'm' });
    expect(unitLabel(system, 'force')).toBe('t');
    expect(unitLabel(system, 'moment')).toBe('t·m');
    expect(toDisplay(1, system, 'force')).toBeCloseTo(0.1019716212978);
    expect(fromDisplay(toDisplay(3.25, system, 'moment'), system, 'moment')).toBeCloseTo(3.25);
  });

  it('accepts every standard profile and exposes labels for every quantity', () => {
    expect(UNIT_SYSTEM_PROFILES.map((profile) => profile.id)).toEqual(UNIT_SYSTEM_IDS);
    for (const profile of UNIT_SYSTEM_PROFILES) {
      expect(isUnitSystemId(profile.id)).toBe(true);
      for (const quantity of UNIT_QUANTITIES) {
        expect(unitLabel(profile.id, quantity)).toEqual(expect.any(String));
      }
    }
  });

  it('recognizes all supported custom labels for equation formatting', () => {
    expect(ALL_UNIT_LABELS.has('lb/ft')).toBe(true);
    expect(ALL_UNIT_LABELS.has('t·m')).toBe(true);
    expect(ALL_UNIT_LABELS.has('kg/m³')).toBe(true);
  });

  it('keeps special 2D labels and display formatting in the presentation adapter', () => {
    const custom = createCustomUnitSystemId('T/M', 't', 'm');

    expect(unitLabel('kN-m', 'elasticModulus')).toBe('MPa');
    expect(unitLabel('kgf-m', 'area')).toBe('cm²');
    expect(unitLabel('kip-ft', 'sectionDimension')).toBe('in');
    expect(unitSystemLabel(custom)).toBe('T/M');
    expect(formatDisplay(2, 'kN-m', 'elasticModulus', 3)).toBe('0.002 MPa');
  });

  it('rejects malformed custom profiles', () => {
    expect(isUnitSystemId('custom:bad:bogus:m')).toBe(false);
    expect(isUnitSystemId('custom:T%2FM:t:unknown')).toBe(false);
    expect(isUnitSystemId('custom::t:m')).toBe(false);
  });
});
