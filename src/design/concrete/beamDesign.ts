import { NTC_CONCRETE_2023, betaOne, equivalentBlockStrengthMpa } from './ntcConcrete2023';
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
    input.concrete.elasticModulusMpa,
    input.concrete.modulusOfRuptureMpa,
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
    ...input.reinforcement.preferredLongitudinalDiametersMm,
    ...input.reinforcement.preferredStirrupDiametersMm,
  ];
  if (
    finiteValues.some((value) => !Number.isFinite(value))
    || finiteValues.slice(0, 13).some((value) => value <= 0)
    || input.analysis.ultimate.positiveMomentKnm < 0
    || input.analysis.ultimate.negativeMomentKnm > 0
    || input.analysis.ultimate.absoluteShearKn < 0
    || input.analysis.ultimate.compressionKn < 0
    || input.analysis.service.grossElasticDeflectionMm < 0
    || input.reinforcement.preferredLongitudinalDiametersMm.length === 0
    || input.reinforcement.preferredStirrupDiametersMm.length === 0
  ) return 'invalid-input';

  const { widthMm: width, heightMm: height } = input.section;
  const axialLimitKn = input.concrete.compressiveStrengthMpa * width * height / 10 / 1_000;
  if (
    input.spanMm / height < 5
    || height / width > 6
    || height < 250
    || input.analysis.ultimate.compressionKn >= axialLimitKn
  ) return 'unsupported-v1-input';
  return undefined;
}

function barArea(diameterMm: number): number {
  return PI * diameterMm ** 2 / 4;
}

function effectiveDepthMm(input: ConcreteBeamDesignInput, barDiameterMm: number, stirrupDiameterMm: number): number {
  return input.section.heightMm - input.reinforcement.coverMm - stirrupDiameterMm - barDiameterMm / 2;
}

function requiredFlexuralAreaMm2(
  demandKnm: number,
  widthMm: number,
  effectiveDepth: number,
  yieldStrengthMpa: number,
  blockStrengthMpa: number,
): number | undefined {
  if (demandKnm === 0) return 0;
  const momentNmm = demandKnm * 1_000_000;
  const phi = NTC_CONCRETE_2023.flexureResistanceFactor;
  const coefficient = 0.5 * yieldStrengthMpa / (widthMm * effectiveDepth * blockStrengthMpa);
  const normalizedDemand = momentNmm / (phi * yieldStrengthMpa * effectiveDepth);
  const discriminant = 1 - 4 * coefficient * normalizedDemand;
  if (discriminant < 0) return undefined;
  return (1 - Math.sqrt(discriminant)) / (2 * coefficient);
}

function flexuralStrengthKnm(
  areaMm2: number,
  widthMm: number,
  effectiveDepth: number,
  yieldStrengthMpa: number,
  blockStrengthMpa: number,
): number {
  const ratio = areaMm2 / (widthMm * effectiveDepth);
  const q = ratio * yieldStrengthMpa / blockStrengthMpa;
  return NTC_CONCRETE_2023.flexureResistanceFactor * areaMm2 * yieldStrengthMpa * effectiveDepth * (1 - 0.5 * q) / 1_000_000;
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
    const requiredArea = requiredFlexuralAreaMm2(demandKnm, width, depth, fy, fpp);
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
        designStrengthKnm: flexuralStrengthKnm(area, width, depth, fy, fpp),
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
  requiredRatio: number,
  maximumSpacingMm: number,
): StirrupCandidate | undefined {
  const candidates: StirrupCandidate[] = [];
  const increment = input.reinforcement.stirrupSpacingIncrementMm;
  input.reinforcement.preferredStirrupDiametersMm.forEach((diameter, preferenceIndex) => {
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
  });
  candidates.sort((left, right) =>
    left.deficit - right.deficit
    || left.excess - right.excess
    || left.preferenceIndex - right.preferenceIndex
    || right.spacingMm - left.spacingMm,
  );
  return candidates[0];
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

  const stirrupDiameter = input.reinforcement.preferredStirrupDiametersMm[0]!;
  const positive = selectLongitudinal(input, input.analysis.ultimate.positiveMomentKnm, stirrupDiameter);
  const negative = selectLongitudinal(input, Math.abs(input.analysis.ultimate.negativeMomentKnm), stirrupDiameter);
  if (positive === undefined || negative === undefined) return blocked(input, 'no-longitudinal-arrangement');

  const width = input.section.widthMm;
  const height = input.section.heightMm;
  const fc = input.concrete.compressiveStrengthMpa;
  const fyv = input.reinforcement.stirrupYieldStrengthMpa;
  const depth = Math.min(positive.effectiveDepthMm, negative.effectiveDepthMm);
  const shearDemandN = input.analysis.ultimate.absoluteShearKn * 1_000;
  const concreteNominalShearN = 0.17 * Math.sqrt(fc) * width * depth;
  const concreteDesignShearKn = NTC_CONCRETE_2023.shearResistanceFactor * concreteNominalShearN / 1_000;
  const requiredNominalStirrupShearN = Math.max(0, shearDemandN / NTC_CONCRETE_2023.shearResistanceFactor - concreteNominalShearN);
  const strengthRatio = requiredNominalStirrupShearN / (fyv * depth);
  const minimumRatio = Math.max(0.062 * Math.sqrt(fc) * width / fyv, 0.35 * width / fyv);
  const requiredRatio = Math.max(strengthRatio, minimumRatio);
  const highShearThresholdN = 0.33 * Math.sqrt(fc) * width * depth;
  const highShear = requiredNominalStirrupShearN > highShearThresholdN;
  const maximumLongitudinalSpacing = highShear ? Math.min(depth / 4, 300) : Math.min(depth / 2, 600);
  const maximumTransverseSpacing = highShear ? Math.min(depth / 2, 300) : Math.min(depth, 600);
  const stirrup = selectStirrup(input, requiredRatio, maximumLongitudinalSpacing);
  if (stirrup === undefined) return blocked(input, 'no-stirrup-arrangement');
  const stirrupNominalShearN = stirrup.providedAreaPerSpacingMm * fyv * depth;
  const shearDesignStrengthKn = NTC_CONCRETE_2023.shearResistanceFactor * (concreteNominalShearN + stirrupNominalShearN) / 1_000;
  const maximumDimensionShearKn = NTC_CONCRETE_2023.shearResistanceFactor
    * (concreteNominalShearN + 0.66 * Math.sqrt(fc) * width * depth) / 1_000;
  const transverseLegSpacing = width - 2 * (input.reinforcement.coverMm + stirrup.diameterMm / 2);

  const selectedForService = input.analysis.service.governingMomentKnm >= 0 ? positive : negative;
  const grossInertia = width * height ** 3 / 12;
  const modularRatio = input.reinforcement.steelElasticModulusMpa / input.concrete.elasticModulusMpa;
  const transformedArea = modularRatio * selectedForService.areaMm2;
  const neutralAxis = (-transformedArea + Math.sqrt(transformedArea ** 2 + 2 * width * transformedArea * selectedForService.effectiveDepthMm)) / width;
  const crackedInertia = width * neutralAxis ** 3 / 3
    + transformedArea * (selectedForService.effectiveDepthMm - neutralAxis) ** 2;
  const crackingMomentKnm = input.concrete.modulusOfRuptureMpa * grossInertia / (height / 2) / 1_000_000;
  const serviceMoment = Math.abs(input.analysis.service.governingMomentKnm);
  const effectiveInertia = serviceMoment <= 2 * crackingMomentKnm / 3 || serviceMoment === 0
    ? grossInertia
    : crackedInertia / (1 - ((2 * crackingMomentKnm / 3 / serviceMoment) ** 2) * (1 - crackedInertia / grossInertia));
  const immediateDeflection = input.analysis.service.grossElasticDeflectionMm * grossInertia / effectiveInertia;
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
    check('shear-strength', ['5.5.3.1.1-5.5.3.1.2', '5.5.3.6.1-5.5.3.6.2'], input.analysis.ultimate.absoluteShearKn, shearDesignStrengthKn, 'kN', 'Resistencia combinada de concreto y estribos.'),
    check('maximum-shear-dimension', ['5.5.2.2'], input.analysis.ultimate.absoluteShearKn, maximumDimensionShearKn, 'kN', 'Límite de esfuerzo cortante por dimensiones.'),
    check('minimum-stirrup-ratio', ['6.3.5.4.1-6.3.5.4.4'], minimumRatio, stirrup.providedAreaPerSpacingMm, 'mm²/mm', 'Cuantía transversal normalizada Av/s.'),
    check('stirrup-longitudinal-spacing', ['6.3.7.6.2.2'], stirrup.spacingMm, maximumLongitudinalSpacing, 'mm', 'Separación longitudinal de estribos.'),
    check('stirrup-transverse-spacing', ['6.3.7.6.2.2'], transverseLegSpacing, maximumTransverseSpacing, 'mm', 'Separación transversal entre ramas.'),
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
        requiredAreaPerSpacingMm: requiredRatio,
        providedAreaPerSpacingMm: stirrup.providedAreaPerSpacingMm,
        concreteDesignStrengthKn: concreteDesignShearKn,
        designStrengthKn: shearDesignStrengthKn,
        maximumLongitudinalSpacingMm: maximumLongitudinalSpacing,
        transverseLegSpacingMm: transverseLegSpacing,
        maximumTransverseLegSpacingMm: maximumTransverseSpacing,
      },
    },
    service: {
      grossInertiaMm4: grossInertia,
      crackedTransformedInertiaMm4: crackedInertia,
      effectiveInertiaMm4: effectiveInertia,
      immediateDeflectionMm: immediateDeflection,
      totalDeflectionLimitMm: totalDeflectionLimit,
      totalConclusion: 'not-evaluated',
    },
    checks,
    warnings: ['La conclusión reglamentaria total de servicio no se evalúa sin efectos de largo plazo.'],
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
