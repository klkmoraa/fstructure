// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveReinforcementProposalMessage } from './reinforcementProposalCompute';
import { COLUMN_DEFAULTS } from './columnProposal';

describe('pure reinforcement proposal worker boundary', () => {
  it('computes a section proposal without browser globals or UI modules', () => {
    expect(globalThis).not.toHaveProperty('window');
    const result = resolveReinforcementProposalMessage({
      kind: 'section', requestId: 1,
      snapshot: {
        tag: '', place: '', preset: 'custom', level: 'simple', shape: 'rectangle', width: '30', height: '55', cover: '4',
        fc: '250', fy: '4200', bar: '19.1', barCount: '8', barLayout: 'layers', topBarCount: '2', bottomBarCount: '4',
        cornerBarCount: '1', faceBarCount: '1', tie: '9.5', tieType: 'closed', tieSpacing: '15', length: '3',
        philosophy: 'ultimate', demandBasis: 'factored', loadFactor: '1.4', axial: '0', moment: '100', shear: '0', angle: '0',
        phi: '0.75', gammaConcrete: '1.5', gammaSteel: '1.15', allowableConcrete: '0.45', allowableSteel: '0.6',
      },
      diametersMm: [9.5, 12.7, 15.9, 19.1, 22.2, 25.4],
    });
    expect(result).toMatchObject({ kind: 'proposed', requestId: 1, fields: { bar: expect.any(String), barCount: expect.any(String) } });
  });

  it('computes a column proposal without browser globals or UI modules', () => {
    expect(globalThis).not.toHaveProperty('window');
    const result = resolveReinforcementProposalMessage({
      kind: 'column', requestId: 2, code: 'ntc-2023', snapshot: COLUMN_DEFAULTS,
    });
    expect(result).toMatchObject({ kind: 'proposed', requestId: 2, fields: { bar: expect.any(String), barsWidth: expect.any(String), barsDepth: expect.any(String) } });
  });
});
