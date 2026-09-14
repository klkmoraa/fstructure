/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { designReinforcedConcreteBeam } from './beamDesign';
import type { ConcreteBeamDesignInput } from './types';

interface Fixture {
  readonly input: ConcreteBeamDesignInput;
  readonly expected: Record<string, unknown>;
}

const fixture = JSON.parse(readFileSync(
  join(process.cwd(), 'validation/fixtures/concrete-beam/baseline.json'),
  'utf8',
)) as Fixture;

describe('concrete beam cross-language fixture', () => {
  it('matches the numeric projection consumed by the independent Python oracle', () => {
    const outcome = designReinforcedConcreteBeam(fixture.input);
    expect(outcome.status).toBe('available');
    if (outcome.status !== 'available') throw new Error(outcome.blockers.join(', '));

    const actual: Record<string, unknown> = {
      status: outcome.status,
      positiveRequiredAreaMm2: outcome.flexure.positive.requiredAreaMm2,
      negativeRequiredAreaMm2: outcome.flexure.negative.requiredAreaMm2,
      positiveDesignStrengthKnm: outcome.flexure.positive.designStrengthKnm,
      negativeDesignStrengthKnm: outcome.flexure.negative.designStrengthKnm,
      bottomDiameterMm: outcome.reinforcement.bottom.diameterMm,
      bottomCount: outcome.reinforcement.bottom.count,
      bottomEffectiveDepthMm: outcome.reinforcement.bottom.effectiveDepthMm,
      topDiameterMm: outcome.reinforcement.top.diameterMm,
      topCount: outcome.reinforcement.top.count,
      topEffectiveDepthMm: outcome.reinforcement.top.effectiveDepthMm,
      rejectedLongitudinalDiametersMm: outcome.reinforcement.rejectedLongitudinalDiameters.map(({ diameterMm }) => diameterMm),
      stirrupDiameterMm: outcome.reinforcement.stirrups.diameterMm,
      stirrupSpacingMm: outcome.reinforcement.stirrups.spacingMm,
      requiredAreaPerSpacingMm: outcome.reinforcement.stirrups.requiredAreaPerSpacingMm,
      providedAreaPerSpacingMm: outcome.reinforcement.stirrups.providedAreaPerSpacingMm,
      concreteDesignStrengthKn: outcome.reinforcement.stirrups.concreteDesignStrengthKn,
      shearDesignStrengthKn: outcome.reinforcement.stirrups.designStrengthKn,
      meanFlexuralTensileStrengthMpa: outcome.service.meanFlexuralTensileStrengthMpa,
      concreteElasticModulusMpa: outcome.service.concreteElasticModulusMpa,
      concretePropertyBasis: outcome.service.concretePropertyBasis,
      grossInertiaMm4: outcome.service.grossInertiaMm4,
      crackedTransformedInertiaMm4: outcome.service.crackedTransformedInertiaMm4,
      effectiveInertiaMm4: outcome.service.effectiveInertiaMm4,
      immediateDeflectionMm: outcome.service.immediateDeflectionMm,
      totalDeflectionLimitMm: outcome.service.totalDeflectionLimitMm,
      totalConclusion: outcome.service.totalConclusion,
    };
    for (const [key, expected] of Object.entries(fixture.expected)) {
      const received = actual[key];
      if (typeof expected === 'number') {
        expect(Math.abs((received as number) - expected), key).toBeLessThanOrEqual(1e-3);
      } else {
        expect(received, key).toEqual(expected);
      }
    }
  });
});
