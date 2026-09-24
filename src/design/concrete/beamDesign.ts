import { flexuralCapacity, requiredFlexuralSteelMm2 } from '../elements/shared';
import { NTC_CONCRETE_2023, betaOne, classOneConcreteProperties, equivalentBlockStrengthMpa } from './ntcConcrete2023';
import type {
  ConcreteBeamDesignAvailable,
  ConcreteBeamDesignInput,
  ConcreteBeamDesignOutcome,
  ConcreteDesignBlocker,
  ConcreteDesignCheck,
  LongitudinalArrangement,
} from './types';

const PI = Math.PI;

interface LongitudinalCandidate extends LongitudinalArrangement {
  readonly requiredAreaMm2: number;
  readonly minimumAreaMm2: number;
  readonly maximumAreaMm2: number;
  readonly designStrengthKnm: number;
  readonly preferenceIndex: number;
  readonly deficitMm2: number;
  readonly excessMm2: number;
}

interface StirrupCandidate {
  readonly diameterMm: number;
  readonly spacingMm: number;
  readonly providedAreaPerSpacingMm: number;
  readonly preferenceIndex: number;
  readonly deficit: number;
  readonly excess: number;
}

interface CoupledConfiguration {
  readonly positive: LongitudinalCandidate;
  readonly negative: LongitudinalCandidate;
  readonly stirrup: StirrupCandidate;
  readonly depthMm: number;
  readonly requiredRatio: number;
  readonly minimumRatio: number;
  readonly concreteNominalShearN: number;
  readonly concreteDesignShearKn: number;
  readonly shearDesignStrengthKn: number;
  readonly maximumDimensionShearKn: number;
  readonly maximumLongitudinalSpacingMm: number;
  readonly maximumTransverseSpacingMm: number;
  readonly transverseLegSpacingMm: number;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function blocked(input: ConcreteBeamDesignInput, blocker: ConcreteDesignBlocker): ConcreteBeamDesignOutcome {
  return deepFreeze({ status: 'blocked', scope: 'incomplete', memberId: input.memberId, blockers: [blocker] });
}

function isTraceableCombination(
  combination: ConcreteBeamDesignInput['analysis']['ultimate']['combination'],
  stateLimit: 'ultimate' | 'service',
): boolean {
  const normalizedJurisdiction = combination.jurisdiction
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return combination.stateLimit === stateLimit
    && combination.edition === '2023'
    && normalizedJurisdiction.includes('ciudad de mexico')
    && combination.id.trim().length > 0
    && /^https?:\/\//.test(combination.sourceUrl);
}

function firstGateFailure(input: ConcreteBeamDesignInput): ConcreteDesignBlocker | undefined {
  if (input.section.origin !== 'catalog' || input.section.catalogId.trim().length === 0) return 'catalog-section-required';
  if (input.concrete.origin !== 'catalog' || input.concrete.catalogId.trim().length === 0) return 'catalog-material-required';
  if (input.analysis.reliability !== 'reliable') return 'reliable-analysis-required';
  if (!isTraceableCombination(input.analysis.ultimate.combination, 'ultimate')) return 'traceable-ultimate-combination-required';
  if (!isTraceableCombination(input.analysis.service.combination, 'service')) return 'traceable-service-combination-required';

  const evidence = input.normativeEvidence;
  if (
    evidence?.sourceUrl !== NTC_CONCRETE_2023.sourceUrl
    || evidence.sourceSha256 !== NTC_CONCRETE_2023.sourceSha256
    || !NTC_CONCRETE_2023.implementedClauseIds.every((clauseId) => evidence.verifiedClauseIds.includes(clauseId))
  ) return 'complete-normative-evidence-required';

  if (
    input.standardId !== NTC_CONCRETE_2023.standardId
    || input.section.shape !== 'rectangular'
    || input.concrete.density !== 'normal'
    || input.system.ductility !== 'low'
    || input.system.prestressed
  ) return 'unsupported-v1-input';

  const finiteValues = [
    input.spanMm,
    input.section.widthMm,
    input.section.heightMm,
    input.concrete.compressiveStrengthMpa,
    input.reinforcement.coverMm,
    input.reinforcement.maximumAggregateSizeMm,
    input.reinforcement.longitudinalYieldStrengthMpa,
    input.reinforcement.stirrupYieldStrengthMpa,
    input.reinforcement.steelElasticModulusMpa,
    input.reinforcement.stirrupLegs,
    input.reinforcement.stirrupSpacingIncrementMm,
    input.analysis.ultimate.positiveMomentKnm,
    input.analysis.ultimate.negativeMomentKnm,
    input.analysis.ultimate.absoluteShearKn,
    input.analysis.ultimate.compressionKn,
    input.analysis.service.governingMomentKnm,
    input.analysis.service.grossElasticDeflectionMm,
    input.analysis.service.grossElasticModulusMpa,
    ...input.reinforcement.preferredLongitudinalDiametersMm,
    ...input.reinforcement.preferredStirrupDiametersMm,
  ];
  if (
    finiteValues.some((value) => !Number.isFinite(value))
    || finiteValues.slice(0, 11).some((value) => value <= 0)
    || input.reinforcement.preferredLongitudinalDiametersMm.some((value) => value <= 0)
    || input.reinforcement.preferredStirrupDiametersMm.some((value) => value <= 0)
    || !Number.isInteger(input.reinforcement.stirrupLegs)
    || input.reinforcement.stirrupLegs < 2
    || input.analysis.ultimate.positiveMomentKnm < 0
    || input.analysis.ultimate.negativeMomentKnm > 0
    || input.analysis.ultimate.absoluteShearKn < 0
    || input.analysis.ultimate.compressionKn < 0
    || input.analysis.service.grossElasticDeflectionMm < 0
    || input.reinforcement.preferredLongitudinalDiametersMm.length === 0
    || input.reinforcement.preferredStirrupDiametersMm.length === 0
  ) return 'invalid-input';

  const { widthMm: width, heightMm: height } = input.section;
  if (
    classOneConcreteProperties(input.concrete.compressiveStrengthMpa, input.concrete.coarseAggregate) === undefined
    ||
    input.spanMm / height < 5
    || height / width > 6
    || height < 250
    || input.reinforcement.stirrupLegs !== 2
    || input.analysis.ultimate.compressionKn !== 0
  ) return 'unsupported-v1-input';
  return undefined;
}

function barArea(diameterMm: number): number {
  return PI * diameterMm ** 2 / 4;
}

function effectiveDepthMm(input: ConcreteBeamDesignInput, barDiameterMm: number, stirrupDiameterMm: number): number {
  return input.section.heightMm - input.reinforcement.coverMm - stirrupDiameterMm - barDiameterMm / 2;
}

/**
 * FR para flexión según la deformación del acero en tensión (tabla 3.8.2.2 de
 * la NTC 2023): con la cuantía máxima de 0.9ρb la sección queda en transición
 * y FR ≈ 0.70, no 0.90. Se delega en el cálculo compartido de los elementos.
 */
function requiredFlexuralAreaMm2(
  demandKnm: number,
  widthMm: number,
  effectiveDepth: number,
  yieldStrengthMpa: number,
  compressiveStrengthMpa: number,
): number | undefined {
  return requiredFlexuralSteelMm2(demandKnm, widthMm, effectiveDepth, yieldStrengthMpa, compressiveStrengthMpa);
}

function flexuralStrengthKnm(
  areaMm2: number,
  widthMm: number,
  effectiveDepth: number,
  yieldStrengthMpa: number,
  compressiveStrengthMpa: number,
): number {
  return flexuralCapacity(areaMm2, widthMm, effectiveDepth, yieldStrengthMpa, compressiveStrengthMpa).strengthKnm;
}

function selectLongitudinal(
  input: ConcreteBeamDesignInput,
  demandKnm: number,
  stirrupDiameterMm: number,
): LongitudinalCandidate | undefined {
  const { widthMm: width } = input.section;
  const fc = input.concrete.compressiveStrengthMpa;
  const fy = input.reinforcement.longitudinalYieldStrengthMpa;
  const fpp = equivalentBlockStrengthMpa(fc);
  const beta = betaOne(fc);
  const candidates: LongitudinalCandidate[] = [];

  input.reinforcement.preferredLongitudinalDiametersMm.forEach((diameter, preferenceIndex) => {
    if (diameter < NTC_CONCRETE_2023.minimumLongitudinalBarDiameterMm) return;
    const depth = effectiveDepthMm(input, diameter, stirrupDiameterMm);
    const requiredArea = requiredFlexuralAreaMm2(demandKnm, width, depth, fy, fc);
    if (requiredArea === undefined || depth <= 0) return;
    const minimumArea = Math.max(0.25 * Math.sqrt(fc) * width * depth / Math.min(fy, 560), 1.4 * width * depth / Math.min(fy, 560));
    const balancedArea = fpp / fy * (600 * beta / (fy + 600)) * width * depth;
    const maximumArea = 0.9 * balancedArea;
    const targetArea = Math.max(requiredArea, minimumArea);
    const minimumClearSpacing = Math.max(25, diameter, 1.5 * input.reinforcement.maximumAggregateSizeMm);
    const availableInsideWidth = width - 2 * (input.reinforcement.coverMm + stirrupDiameterMm);
    const serviceStressMpa = 2 * fy / 3;
    const clearCoverToBarMm = input.reinforcement.coverMm + stirrupDiameterMm;
    const maximumCrackSpacing = Math.min(
      380 * (280 / serviceStressMpa) - 2.5 * clearCoverToBarMm,
      300 * (280 / serviceStressMpa),
    );

    for (let count = 2; count <= 30; count += 1) {
      const area = count * barArea(diameter);
      const clearSpacing = (availableInsideWidth - count * diameter) / (count - 1);
      const centerSpacing = clearSpacing + diameter;
      if (clearSpacing < minimumClearSpacing || area > maximumArea) continue;
      candidates.push({
        diameterMm: diameter,
        count,
        areaMm2: area,
        effectiveDepthMm: depth,
        clearSpacingMm: clearSpacing,
        minimumClearSpacingMm: minimumClearSpacing,
        centerSpacingMm: centerSpacing,
        maximumCrackControlSpacingMm: maximumCrackSpacing,
        requiredAreaMm2: requiredArea,
        minimumAreaMm2: minimumArea,
        maximumAreaMm2: maximumArea,
        designStrengthKnm: flexuralStrengthKnm(area, width, depth, fy, fc),
        preferenceIndex,
        deficitMm2: Math.max(0, targetArea - area),
        excessMm2: Math.max(0, area - targetArea),
      });
    }
  });

  candidates.sort((left, right) =>
    left.deficitMm2 - right.deficitMm2
    || left.excessMm2 - right.excessMm2
    || left.count - right.count
    || left.preferenceIndex - right.preferenceIndex
    || left.diameterMm - right.diameterMm,
  );
  return candidates[0];
}

function status(demand: number, capacity: number): 'pass' | 'fail' {
  return demand <= capacity + 1e-9 ? 'pass' : 'fail';
}

function check(
  id: ConcreteDesignCheck['id'],
  clauseIds: readonly string[],
  demand: number,
  capacity: number,
  unit: string,
  message: string,
): ConcreteDesignCheck {
  return { id, status: status(demand, capacity), clauseIds, demand: { value: demand, unit }, capacity: { value: capacity, unit }, message };
}

function selectStirrup(
  input: ConcreteBeamDesignInput,
  diameter: number,
  preferenceIndex: number,
  requiredRatio: number,
  maximumSpacingMm: number,
): StirrupCandidate | undefined {
  const candidates: StirrupCandidate[] = [];
  const increment = input.reinforcement.stirrupSpacingIncrementMm;
  const area = input.reinforcement.stirrupLegs * barArea(diameter);
  for (let spacing = increment; spacing <= maximumSpacingMm + 1e-9; spacing += increment) {
    const provided = area / spacing;
    candidates.push({
      diameterMm: diameter,
      spacingMm: spacing,
      providedAreaPerSpacingMm: provided,
      preferenceIndex,
      deficit: Math.max(0, requiredRatio - provided),
      excess: Math.max(0, provided - requiredRatio),
    });
  }
  candidates.sort((left, right) =>
    left.deficit - right.deficit
    || left.excess - right.excess
    || left.preferenceIndex - right.preferenceIndex
    || right.spacingMm - left.spacingMm,
  );
  return candidates[0];
}

function coupledConfiguration(
  input: ConcreteBeamDesignInput,
  stirrupDiameterMm: number,
  preferenceIndex: number,
): CoupledConfiguration | undefined {
  const positive = selectLongitudinal(input, input.analysis.ultimate.positiveMomentKnm, stirrupDiameterMm);
  const negative = selectLongitudinal(input, Math.abs(input.analysis.ultimate.negativeMomentKnm), stirrupDiameterMm);
  if (positive === undefined || negative === undefined) return undefined;

  const width = input.section.widthMm;
  const fc = input.concrete.compressiveStrengthMpa;
  const fyv = input.reinforcement.stirrupYieldStrengthMpa;
  const depthMm = Math.min(positive.effectiveDepthMm, negative.effectiveDepthMm);
  const shearDemandN = input.analysis.ultimate.absoluteShearKn * 1_000;
  const concreteNominalShearN = 0.17 * Math.sqrt(fc) * width * depthMm;
  const concreteDesignShearKn = NTC_CONCRETE_2023.shearResistanceFactor * concreteNominalShearN / 1_000;
  const requiredNominalStirrupShearN = Math.max(0, shearDemandN / NTC_CONCRETE_2023.shearResistanceFactor - concreteNominalShearN);
  const strengthRatio = requiredNominalStirrupShearN / (fyv * depthMm);
  const minimumRatio = Math.max(0.062 * Math.sqrt(fc) * width / fyv, 0.35 * width / fyv);
  const requiredRatio = Math.max(strengthRatio, minimumRatio);
  const highShearThresholdN = 0.33 * Math.sqrt(fc) * width * depthMm;
  const highShear = requiredNominalStirrupShearN > highShearThresholdN;
  const maximumLongitudinalSpacingMm = highShear ? Math.min(depthMm / 4, 300) : Math.min(depthMm / 2, 600);
  const maximumTransverseSpacingMm = highShear ? Math.min(depthMm / 2, 300) : Math.min(depthMm, 600);
  const stirrup = selectStirrup(input, stirrupDiameterMm, preferenceIndex, requiredRatio, maximumLongitudinalSpacingMm);
  if (stirrup === undefined) return undefined;
  const stirrupNominalShearN = stirrup.providedAreaPerSpacingMm * fyv * depthMm;
  const shearDesignStrengthKn = NTC_CONCRETE_2023.shearResistanceFactor * (concreteNominalShearN + stirrupNominalShearN) / 1_000;
  const maximumDimensionShearKn = NTC_CONCRETE_2023.shearResistanceFactor
    * (concreteNominalShearN + 0.66 * Math.sqrt(fc) * width * depthMm) / 1_000;
  const transverseLegSpacingMm = width - 2 * (input.reinforcement.coverMm + stirrupDiameterMm / 2);
  return {
    positive,
    negative,
    stirrup,
    depthMm,
    requiredRatio,
    minimumRatio,
    concreteNominalShearN,
    concreteDesignShearKn,
    shearDesignStrengthKn,
    maximumDimensionShearKn,
    maximumLongitudinalSpacingMm,
    maximumTransverseSpacingMm,
    transverseLegSpacingMm,
  };
}

function publicArrangement(candidate: LongitudinalCandidate): LongitudinalArrangement {
  return {
    diameterMm: candidate.diameterMm,
    count: candidate.count,
    areaMm2: candidate.areaMm2,
    effectiveDepthMm: candidate.effectiveDepthMm,
    clearSpacingMm: candidate.clearSpacingMm,
    minimumClearSpacingMm: candidate.minimumClearSpacingMm,
    centerSpacingMm: candidate.centerSpacingMm,
    maximumCrackControlSpacingMm: candidate.maximumCrackControlSpacingMm,
  };
}

export function designReinforcedConcreteBeam(input: ConcreteBeamDesignInput): ConcreteBeamDesignOutcome {
  const gateFailure = firstGateFailure(input);
  if (gateFailure !== undefined) return blocked(input, gateFailure);

  const configurations = input.reinforcement.preferredStirrupDiametersMm.flatMap((diameter, preferenceIndex) => {
    const candidate = coupledConfiguration(input, diameter, preferenceIndex);
    return candidate ? [candidate] : [];
  });
  if (configurations.length === 0) return blocked(input, 'no-longitudinal-arrangement');
  configurations.sort((left, right) =>
    left.stirrup.deficit - right.stirrup.deficit
    || left.stirrup.excess - right.stirrup.excess
    || left.stirrup.preferenceIndex - right.stirrup.preferenceIndex
    || right.stirrup.spacingMm - left.stirrup.spacingMm,
  );
  const configuration = configurations[0]!;
  const { positive, negative, stirrup } = configuration;
  const width = input.section.widthMm;
  const height = input.section.heightMm;
  const concreteProperties = classOneConcreteProperties(input.concrete.compressiveStrengthMpa, input.concrete.coarseAggregate)!;

  const selectedForService = input.analysis.service.governingMomentKnm >= 0 ? positive : negative;
  const grossInertia = width * height ** 3 / 12;
  const modularRatio = input.reinforcement.steelElasticModulusMpa / concreteProperties.elasticModulusMpa;
  const transformedArea = modularRatio * selectedForService.areaMm2;
  const neutralAxis = (-transformedArea + Math.sqrt(transformedArea ** 2 + 2 * width * transformedArea * selectedForService.effectiveDepthMm)) / width;
  const crackedInertia = width * neutralAxis ** 3 / 3
    + transformedArea * (selectedForService.effectiveDepthMm - neutralAxis) ** 2;
  const crackingMomentKnm = concreteProperties.meanFlexuralTensileStrengthMpa * grossInertia / (height / 2) / 1_000_000;
  const serviceMoment = Math.abs(input.analysis.service.governingMomentKnm);
  const effectiveInertia = serviceMoment <= 2 * crackingMomentKnm / 3 || serviceMoment === 0
    ? grossInertia
    : crackedInertia / (1 - ((2 * crackingMomentKnm / 3 / serviceMoment) ** 2) * (1 - crackedInertia / grossInertia));
  const immediateDeflection = input.analysis.service.grossElasticDeflectionMm
    * input.analysis.service.grossElasticModulusMpa
    * grossInertia
    / (concreteProperties.elasticModulusMpa * effectiveInertia);
  const totalDeflectionLimit = input.analysis.service.damagesNonstructuralElements
    ? 3 + input.spanMm / 480
    : 5 + input.spanMm / 240;

  const checks: ConcreteDesignCheck[] = [
    check('flexure-positive', ['5.2.2.1.1.1', '3.8.2.1-3.8.2.2'], input.analysis.ultimate.positiveMomentKnm, positive.designStrengthKnm, 'kN·m', 'Resistencia de flexión positiva.'),
    check('flexure-negative', ['5.2.2.1.1.1', '3.8.2.1-3.8.2.2'], Math.abs(input.analysis.ultimate.negativeMomentKnm), negative.designStrengthKnm, 'kN·m', 'Resistencia de flexión negativa.'),
    check('minimum-steel-positive', ['6.3.5.1.1-6.3.5.2.1'], positive.minimumAreaMm2, positive.areaMm2, 'mm²', 'Acero mínimo en lecho positivo.'),
    check('maximum-steel-positive', ['5.2.1.3.1', '6.3.5.1.1-6.3.5.2.1'], positive.areaMm2, positive.maximumAreaMm2, 'mm²', 'Acero máximo en lecho positivo.'),
    check('minimum-steel-negative', ['6.3.5.1.1-6.3.5.2.1'], negative.minimumAreaMm2, negative.areaMm2, 'mm²', 'Acero mínimo en lecho negativo.'),
    check('maximum-steel-negative', ['5.2.1.3.1', '6.3.5.1.1-6.3.5.2.1'], negative.areaMm2, negative.maximumAreaMm2, 'mm²', 'Acero máximo en lecho negativo.'),
    check('shear-strength', ['5.5.3.1.1-5.5.3.1.2', '5.5.3.6.1-5.5.3.6.2'], input.analysis.ultimate.absoluteShearKn, configuration.shearDesignStrengthKn, 'kN', 'Resistencia combinada de concreto y estribos.'),
    check('maximum-shear-dimension', ['5.5.2.2'], input.analysis.ultimate.absoluteShearKn, configuration.maximumDimensionShearKn, 'kN', 'Límite de esfuerzo cortante por dimensiones.'),
    check('minimum-stirrup-ratio', ['6.3.5.4.1-6.3.5.4.4'], configuration.minimumRatio, stirrup.providedAreaPerSpacingMm, 'mm²/mm', 'Cuantía transversal normalizada Av/s.'),
    check('stirrup-longitudinal-spacing', ['6.3.7.6.2.2'], stirrup.spacingMm, configuration.maximumLongitudinalSpacingMm, 'mm', 'Separación longitudinal de estribos.'),
    check('stirrup-transverse-spacing', ['6.3.7.6.2.2'], configuration.transverseLegSpacingMm, configuration.maximumTransverseSpacingMm, 'mm', 'Separación transversal entre ramas.'),
    check('bar-clear-spacing-positive', ['14.2.1'], positive.minimumClearSpacingMm, positive.clearSpacingMm, 'mm', 'Separación libre del lecho positivo.'),
    check('bar-crack-spacing-positive', ['13.6.1-13.6.2.1'], positive.centerSpacingMm, positive.maximumCrackControlSpacingMm, 'mm', 'Separación máxima por agrietamiento del lecho positivo.'),
    check('bar-clear-spacing-negative', ['14.2.1'], negative.minimumClearSpacingMm, negative.clearSpacingMm, 'mm', 'Separación libre del lecho negativo.'),
    check('bar-crack-spacing-negative', ['13.6.1-13.6.2.1'], negative.centerSpacingMm, negative.maximumCrackControlSpacingMm, 'mm', 'Separación máxima por agrietamiento del lecho negativo.'),
    {
      id: 'total-service-deflection',
      status: 'not-evaluated',
      clauseIds: ['13.4.1.1', '13.4.2.1-13.4.3.3'],
      demand: { value: immediateDeflection, unit: 'mm (sólo inmediata)' },
      capacity: { value: totalDeflectionLimit, unit: 'mm (total)' },
      message: 'No se concluye servicio total: faltan deformaciones de largo plazo.',
    },
  ];

  const output: ConcreteBeamDesignAvailable = {
    status: 'available',
    scope: 'complete-within-v1',
    memberId: input.memberId,
    binding: {
      analysisId: input.analysisId,
      memberId: input.memberId,
      ultimateCombinationId: input.analysis.ultimate.combination.id,
      serviceCombinationId: input.analysis.service.combination.id,
    },
    flexure: {
      positive: { demandKnm: input.analysis.ultimate.positiveMomentKnm, requiredAreaMm2: positive.requiredAreaMm2, designStrengthKnm: positive.designStrengthKnm },
      negative: { demandKnm: Math.abs(input.analysis.ultimate.negativeMomentKnm), requiredAreaMm2: negative.requiredAreaMm2, designStrengthKnm: negative.designStrengthKnm },
    },
    reinforcement: {
      rejectedLongitudinalDiameters: input.reinforcement.preferredLongitudinalDiametersMm
        .filter((diameter) => diameter < NTC_CONCRETE_2023.minimumLongitudinalBarDiameterMm)
        .map((diameterMm) => ({ diameterMm, reason: 'below-ntc-number-4-diameter' as const })),
      bottom: publicArrangement(positive),
      top: publicArrangement(negative),
      stirrups: {
        diameterMm: stirrup.diameterMm,
        legs: input.reinforcement.stirrupLegs,
        spacingMm: stirrup.spacingMm,
        requiredAreaPerSpacingMm: configuration.requiredRatio,
        providedAreaPerSpacingMm: stirrup.providedAreaPerSpacingMm,
        concreteDesignStrengthKn: configuration.concreteDesignShearKn,
        designStrengthKn: configuration.shearDesignStrengthKn,
        maximumLongitudinalSpacingMm: configuration.maximumLongitudinalSpacingMm,
        transverseLegSpacingMm: configuration.transverseLegSpacingMm,
        maximumTransverseLegSpacingMm: configuration.maximumTransverseSpacingMm,
      },
    },
    service: {
      meanFlexuralTensileStrengthMpa: concreteProperties.meanFlexuralTensileStrengthMpa,
      concreteElasticModulusMpa: concreteProperties.elasticModulusMpa,
      concretePropertyBasis: concreteProperties.basis,
      grossInertiaMm4: grossInertia,
      crackedTransformedInertiaMm4: crackedInertia,
      effectiveInertiaMm4: effectiveInertia,
      immediateDeflectionMm: immediateDeflection,
      totalDeflectionLimitMm: totalDeflectionLimit,
      totalConclusion: 'not-evaluated',
    },
    checks,
    warnings: [
      ...input.reinforcement.preferredLongitudinalDiametersMm
        .filter((diameter) => diameter < NTC_CONCRETE_2023.minimumLongitudinalBarDiameterMm)
        .map((diameter) => `Ø${diameter} mm se conserva como preferencia, pero no se selecciona como barra No. 4 NTC.`),
      'La conclusión reglamentaria total de servicio no se evalúa sin efectos de largo plazo.',
    ],
    notEvaluated: [
      { id: 'refined-cracking', reason: 'V1 sólo evalúa la separación prescriptiva de barras.' },
      { id: 'creep', reason: 'V1 no modela fluencia.' },
      { id: 'shrinkage', reason: 'V1 no modela contracción.' },
      { id: 'long-term-deflection', reason: 'Faltan fluencia y contracción para la deformación total.' },
    ],
    provenance: {
      standardId: input.standardId,
      sourceUrl: NTC_CONCRETE_2023.sourceUrl,
      sourceSha256: NTC_CONCRETE_2023.sourceSha256,
      clauseIds: [...NTC_CONCRETE_2023.implementedClauseIds],
    },
  };
  return deepFreeze(output);
}
