import { describe, expect, it } from 'vitest';

import { hasActivePDeltaForces } from './solver';

describe('P-Delta activation', () => {
  it('requires a non-zero finite axial force', () => {
    expect(hasActivePDeltaForces()).toBe(false);
    expect(hasActivePDeltaForces(new Map([['M1', 0]]))).toBe(false);
    expect(hasActivePDeltaForces(new Map([['M1', Number.NaN]]))).toBe(false);
    expect(hasActivePDeltaForces(new Map([['M1', -0.001]]))).toBe(true);
  });
});
