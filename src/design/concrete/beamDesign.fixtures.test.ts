/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { designReinforcedConcreteBeam } from './beamDesign';
import type { ConcreteBeamDesignInput, ConcreteDesignCheck, ConcreteDesignCheckId } from './types';

const checkCapacity = (checks: readonly ConcreteDesignCheck[], id: ConcreteDesignCheckId): number => {
  const capacity = checks.find((check) => check.id === id)?.capacity?.value;
  if (capacity === undefined) throw new Error(`El resultado no expone la capacidad del check ${id}.`);
  return capacity;
};

interface Fixture {
  readonly input: ConcreteBeamDesignInput;
  readonly expected: Record<string, unknown>;
}

const FIXTURE_DIRECTORY = join(process.cwd(), 'validation/fixtures/concrete-beam');

// El oráculo de Python recorre el directorio completo. TypeScript debe recorrer
// el mismo conjunto: leer sólo `baseline.json` dejaba sin contraste cualquier
// caso añadido para cubrir una rama nueva.
const fixtures = readdirSync(FIXTURE_DIRECTORY)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ name, fixture: JSON.parse(readFileSync(join(FIXTURE_DIRECTORY, name), 'utf8')) as Fixture }));

describe('concrete beam cross-language fixtures', () => {
  it('cubre el baseline y al menos un caso fuera de la meseta de beta1', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    expect(fixtures.some(({ name }) => name === 'baseline.json')).toBe(true);
  });

  it.each(fixtures.filter(({ fixture }) => fixture.expected.status === 'available'))(
    'matches the numeric projection consumed by the independent Python oracle: $name',
    ({ fixture }) => {
    const outcome = designReinforcedConcreteBeam(fixture.input);
    expect(outcome.status).toBe('available');
    if (outcome.status !== 'available') throw new Error(outcome.blockers.join(', '));

    const actual: Record<string, unknown> = {
      status: outcome.status,
      positiveRequiredAreaMm2: outcome.flexure.positive.requiredAreaMm2,
      negativeRequiredAreaMm2: outcome.flexure.negative.requiredAreaMm2,
      positiveDesignStrengthKnm: outcome.flexure.positive.designStrengthKnm,
      negativeDesignStrengthKnm: outcome.flexure.negative.designStrengthKnm,
      // El límite por área balanceada sólo viaja en el check correspondiente.
      // Es la única salida sensible a beta1, así que el contraste entre
      // lenguajes lo necesita para cubrir ese coeficiente.
      positiveMaximumAreaMm2: checkCapacity(outcome.checks, 'maximum-steel-positive'),
      negativeMaximumAreaMm2: checkCapacity(outcome.checks, 'maximum-steel-negative'),
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
  },
  );

  it.each(fixtures.filter(({ fixture }) => fixture.expected.status === 'blocked'))(
    'reproduce el bloqueo declarado por el oráculo: $name',
    ({ fixture }) => {
      const outcome = designReinforcedConcreteBeam(fixture.input);
      expect(outcome.status).toBe('blocked');
      if (outcome.status !== 'blocked') return;
      expect(outcome.blockers).toEqual(fixture.expected.blockers);
    },
  );
});
