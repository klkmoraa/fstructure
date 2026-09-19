/// <reference types="node" />

import { describe, expect, it } from 'vitest';
import { designReinforcedConcreteBeam } from './beamDesign';
import type { ConcreteBeamDesignInput, ConcreteDesignCheck } from './types';

const SOURCE_URL = 'https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf';
const SOURCE_SHA256 = '293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a';
const IMPLEMENTED_CLAUSES = [
  '2.2.1-2.2.7.3',
  '3.6.1',
  '3.8.2.1-3.8.2.2',
  '5.2.1.1.2',
  '5.2.1.3.1',
  '5.2.2.1.1.1',
  '5.5.2.2',
  '5.5.3.1.1-5.5.3.1.2',
  '5.5.3.6.1-5.5.3.6.2',
  '6.3.1.1-6.3.2.2',
  '6.3.3.1.1',
  '6.3.3.3.1',
  '6.3.5.1.1-6.3.5.2.1',
  '6.3.5.4.1-6.3.5.4.4',
  '6.3.7.6.2.2',
  '13.4.1.1',
  '13.4.2.1-13.4.3.3',
  '13.6.1-13.6.2.1',
  '14.2.1',
] as const;

const validInput = (): ConcreteBeamDesignInput => ({
  standardId: 'ntc-cdmx-2023-concrete',
  memberId: 'B1',
  analysisId: 'analysis-ultimate-service-001',
  spanMm: 6_000,
  section: {
    catalogId: 'rect-concrete-300x500',
    origin: 'catalog',
    shape: 'rectangular',
    widthMm: 300,
    heightMm: 500,
  },
  concrete: {
    catalogId: 'concrete-28mpa',
    origin: 'catalog',
    density: 'normal',
    coarseAggregate: 'basalt',
    compressiveStrengthMpa: 28,
  },
  reinforcement: {
    coverMm: 40,
    maximumAggregateSizeMm: 19,
    longitudinalYieldStrengthMpa: 420,
    stirrupYieldStrengthMpa: 420,
    steelElasticModulusMpa: 200_000,
    preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32],
    preferredStirrupDiametersMm: [8, 10, 12],
    stirrupLegs: 2,
    stirrupSpacingIncrementMm: 25,
  },
  system: { ductility: 'low', prestressed: false },
  analysis: {
    reliability: 'reliable',
    ultimate: {
      combination: {
        id: 'ULS-NTC-01',
        stateLimit: 'ultimate',
        jurisdiction: 'Ciudad de México',
        edition: '2023',
        sourceUrl: 'https://example.test/ntc-load-combinations',
      },
      positiveMomentKnm: 120,
      negativeMomentKnm: -80,
      absoluteShearKn: 100,
      compressionKn: 0,
    },
    service: {
      combination: {
        id: 'SLS-NTC-01',
        stateLimit: 'service',
        jurisdiction: 'Ciudad de México',
        edition: '2023',
        sourceUrl: 'https://example.test/ntc-load-combinations',
      },
      governingMomentKnm: 80,
      grossElasticDeflectionMm: 7,
      grossElasticModulusMpa: 24_870.062324,
      damagesNonstructuralElements: false,
    },
  },
  normativeEvidence: {
    sourceUrl: SOURCE_URL,
    sourceSha256: SOURCE_SHA256,
    verifiedClauseIds: [...IMPLEMENTED_CLAUSES],
  },
});

const available = (input = validInput()) => {
  const outcome = designReinforcedConcreteBeam(input);
  expect(outcome.status).toBe('available');
  if (outcome.status !== 'available') throw new Error(`Diseño bloqueado: ${outcome.blockers.join(', ')}`);
  return outcome;
};

const check = (checks: readonly ConcreteDesignCheck[], id: ConcreteDesignCheck['id']) => {
  const found = checks.find((candidate) => candidate.id === id);
  expect(found, `Falta check ${id}`).toBeDefined();
  return found!;
};

describe('designReinforcedConcreteBeam', () => {
  it.each([
    ['catálogo de sección', (input: ConcreteBeamDesignInput) => { input.section.origin = 'custom'; }, 'catalog-section-required'],
    ['catálogo de material', (input: ConcreteBeamDesignInput) => { input.concrete.origin = 'custom'; }, 'catalog-material-required'],
    ['análisis confiable', (input: ConcreteBeamDesignInput) => { input.analysis.reliability = 'limited'; }, 'reliable-analysis-required'],
    ['combinación última trazable', (input: ConcreteBeamDesignInput) => { input.analysis.ultimate.combination.sourceUrl = ''; }, 'traceable-ultimate-combination-required'],
    ['combinación de servicio trazable', (input: ConcreteBeamDesignInput) => { input.analysis.service.combination.edition = '2017'; }, 'traceable-service-combination-required'],
    ['evidencia normativa completa', (input: ConcreteBeamDesignInput) => { input.normativeEvidence = undefined; }, 'complete-normative-evidence-required'],
  ])('bloquea cuando falta %s', (_label, mutate, expectedBlocker) => {
    const input = validInput();
    mutate(input);

    expect(designReinforcedConcreteBeam(input)).toMatchObject({
      status: 'blocked',
      scope: 'incomplete',
      memberId: 'B1',
      blockers: [expectedBlocker],
    });
  });

  it('convierte las unidades explícitas y diseña flexión positiva y negativa con valores literales', () => {
    const outcome = available();

    expect(outcome.binding).toEqual({
      analysisId: 'analysis-ultimate-service-001',
      memberId: 'B1',
      ultimateCombinationId: 'ULS-NTC-01',
      serviceCombinationId: 'SLS-NTC-01',
    });
    expect(outcome.flexure.positive.demandKnm).toBe(120);
    expect(outcome.flexure.positive.requiredAreaMm2).toBeCloseTo(752.512291, 5);
    expect(outcome.flexure.positive.designStrengthKnm).toBeCloseTo(127.787449, 5);
    expect(outcome.flexure.negative.demandKnm).toBe(80);
    expect(outcome.flexure.negative.requiredAreaMm2).toBeCloseTo(492.751117, 5);
    expect(outcome.flexure.negative.designStrengthKnm).toBeCloseTo(97.188909, 5);
    expect(check(outcome.checks, 'flexure-positive').status).toBe('pass');
    expect(check(outcome.checks, 'flexure-negative').status).toBe('pass');
  });

  it('conserva 12 mm como preferencia rechazada y minimiza déficit, exceso y después número de barras', () => {
    const outcome = available();

    expect(outcome.reinforcement.rejectedLongitudinalDiameters).toEqual([
      { diameterMm: 12, reason: 'below-ntc-number-4-diameter' },
    ]);
    expect(outcome.reinforcement.bottom).toMatchObject({ diameterMm: 16, count: 4 });
    expect(outcome.reinforcement.top).toMatchObject({ diameterMm: 16, count: 3 });
    expect(outcome.reinforcement.bottom.areaMm2).toBeCloseTo(804.247719, 5);
    expect(outcome.reinforcement.top.areaMm2).toBeCloseTo(603.185789, 5);
    expect(outcome.reinforcement.top.count).toBe(3);
    expect(check(outcome.checks, 'minimum-steel-positive').status).toBe('pass');
    expect(check(outcome.checks, 'maximum-steel-positive').status).toBe('pass');
    expect(check(outcome.checks, 'minimum-steel-negative').status).toBe('pass');
    expect(check(outcome.checks, 'maximum-steel-negative').status).toBe('pass');
  });

  it('selecciona Av/s normalizado y limita la separación longitudinal y transversal de estribos', () => {
    const outcome = available();
    const stirrups = outcome.reinforcement.stirrups;

    expect(stirrups).toMatchObject({ diameterMm: 8, legs: 2, spacingMm: 200 });
    expect(stirrups.requiredAreaPerSpacingMm).toBeCloseTo(0.25, 8);
    expect(stirrups.providedAreaPerSpacingMm).toBeCloseTo(0.502654825, 8);
    expect(stirrups.concreteDesignStrengthKn).toBeCloseTo(89.865589, 5);
    expect(stirrups.designStrengthKn).toBeGreaterThanOrEqual(100);
    expect(stirrups.maximumLongitudinalSpacingMm).toBeCloseTo(222, 8);
    expect(stirrups.transverseLegSpacingMm).toBeCloseTo(212, 8);
    expect(stirrups.maximumTransverseLegSpacingMm).toBeCloseTo(444, 8);
    expect(check(outcome.checks, 'shear-strength').status).toBe('pass');
    expect(check(outcome.checks, 'minimum-stirrup-ratio').status).toBe('pass');
    expect(check(outcome.checks, 'stirrup-longitudinal-spacing').status).toBe('pass');
    expect(check(outcome.checks, 'stirrup-transverse-spacing').status).toBe('pass');
  });

  it('revisa separación libre y máxima por control de agrietamiento en ambos lechos', () => {
    const outcome = available();

    expect(outcome.reinforcement.bottom.clearSpacingMm).toBeCloseTo(46.666667, 5);
    expect(outcome.reinforcement.bottom.minimumClearSpacingMm).toBeCloseTo(28.5, 8);
    expect(outcome.reinforcement.bottom.centerSpacingMm).toBeCloseTo(62.666667, 5);
    expect(outcome.reinforcement.bottom.maximumCrackControlSpacingMm).toBeCloseTo(260, 8);
    expect(check(outcome.checks, 'bar-clear-spacing-positive').status).toBe('pass');
    expect(check(outcome.checks, 'bar-crack-spacing-positive').status).toBe('pass');
    expect(check(outcome.checks, 'bar-clear-spacing-negative').status).toBe('pass');
    expect(check(outcome.checks, 'bar-crack-spacing-negative').status).toBe('pass');
  });

  it('calcula deflexión elástica inmediata pero no concluye el servicio total sin largo plazo', () => {
    const outcome = available();

    expect(outcome.service.grossInertiaMm4).toBeCloseTo(3_125_000_000, 2);
    expect(outcome.service.crackedTransformedInertiaMm4).toBeCloseTo(1_075_244_549.227, 2);
    expect(outcome.service.effectiveInertiaMm4).toBeCloseTo(1_167_595_438.584, 2);
    expect(outcome.service.immediateDeflectionMm).toBeCloseTo(25.158543, 5);
    expect(outcome.service.totalDeflectionLimitMm).toBeCloseTo(30, 8);
    expect(outcome.service.totalConclusion).toBe('not-evaluated');
    expect(check(outcome.checks, 'total-service-deflection').status).toBe('not-evaluated');
    expect(outcome.notEvaluated.map(({ id }) => id)).toEqual([
      'refined-cracking',
      'creep',
      'shrinkage',
      'long-term-deflection',
    ]);
    expect(outcome.scope).toBe('complete-within-v1');
  });

  it('acopla el peralte efectivo al diámetro de estribo realmente seleccionado', () => {
    const input = validInput();
    input.analysis.ultimate.positiveMomentKnm = 127.2;
    input.analysis.ultimate.absoluteShearKn = 183.7;
    const outcome = available(input);

    expect(outcome.reinforcement.stirrups.diameterMm).toBe(10);
    expect(outcome.reinforcement.bottom.effectiveDepthMm).toBe(
      input.section.heightMm - input.reinforcement.coverMm - 10 - outcome.reinforcement.bottom.diameterMm / 2,
    );
    expect(outcome.flexure.positive.designStrengthKnm).toBeGreaterThanOrEqual(127.2);
    expect(outcome.reinforcement.stirrups.designStrengthKn).toBeGreaterThanOrEqual(183.7);
  });

  it('deriva propiedades medias NTC explícitas para la revisión de servicio', () => {
    const outcome = available();
    const service = outcome.service as typeof outcome.service & {
      meanFlexuralTensileStrengthMpa: number;
      concreteElasticModulusMpa: number;
      concretePropertyBasis: string;
    };

    expect(service.meanFlexuralTensileStrengthMpa).toBeCloseTo(0.63 * Math.sqrt(28), 8);
    expect(service.concreteElasticModulusMpa).toBeCloseTo(3_500 * Math.sqrt(28), 8);
    expect(service.concretePropertyBasis).toBe('ntc-table-2.2.1-class-1a-basalt');
  });

  it.each([
    ['diámetro longitudinal cero', (input: ConcreteBeamDesignInput) => { input.reinforcement.preferredLongitudinalDiametersMm = [0, 16]; }],
    ['diámetro de estribo negativo', (input: ConcreteBeamDesignInput) => { input.reinforcement.preferredStirrupDiametersMm = [-8]; }],
    ['ramas fraccionarias', (input: ConcreteBeamDesignInput) => { input.reinforcement.stirrupLegs = 2.5; }],
  ])('bloquea geometría inválida: %s', (_label, mutate) => {
    const input = validInput();
    mutate(input);
    expect(designReinforcedConcreteBeam(input)).toMatchObject({ status: 'blocked', blockers: ['invalid-input'] });
  });

  it('bloquea cuatro ramas como configuración válida pero fuera del alcance V1', () => {
    const input = validInput();
    input.reinforcement.stirrupLegs = 4;
    expect(designReinforcedConcreteBeam(input)).toMatchObject({ status: 'blocked', blockers: ['unsupported-v1-input'] });
  });

  it('bloquea compresión axial porque V1 no implementa interacción P-M', () => {
    const input = validInput();
    input.analysis.ultimate.compressionKn = 1;
    expect(designReinforcedConcreteBeam(input)).toMatchObject({ status: 'blocked', blockers: ['unsupported-v1-input'] });
  });

  it('es determinista, pura y entrega un resultado profundamente inmutable', () => {
    const input = validInput();
    const snapshot = structuredClone(input);
    const first = available(input);
    const second = available(structuredClone(input));

    expect(input).toEqual(snapshot);
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.reinforcement.bottom)).toBe(true);
    expect(Object.isFrozen(first.checks)).toBe(true);
  });
});
