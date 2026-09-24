import { classOneConcreteProperties } from '../concrete/ntcConcrete2023';
import {
  LOAD_FACTORS,
  
  betaOne,
  complementary,
  e060,
  equivalentBlockStrengthMpa,
  ntc,
  ntcActions,
  nsr,
  requiredFlexuralSteelMm2,
  resistanceFactorForStrain,
  type ClauseReference,
  type FlexureFactor,
  type StructureGroup,
} from './shared';

/**
 * Normas de diseño de concreto que el taller sabe aplicar. Cada perfil reúne
 * los factores, límites y fórmulas que difieren entre normas y la cláusula
 * registrada que respalda cada comprobación. Todo lo numérico que aparece aquí
 * está transcrito en `docs/design/normative-sources.json` con su extracto oficial.
 */
export type DesignCodeId = 'ntc-2023' | 'nsr-10' | 'e060';

export const DESIGN_CODE_IDS: readonly DesignCodeId[] = Object.freeze(['ntc-2023', 'nsr-10', 'e060']);

export const isDesignCodeId = (value: unknown): value is DesignCodeId =>
  typeof value === 'string' && (DESIGN_CODE_IDS as readonly string[]).includes(value);

export interface LoadCombination {
  readonly label: string;
  readonly dead: number;
  /** Factor de la carga muerta de un claro donde su efecto es favorable. */
  readonly favorableDead: number;
  readonly live: number;
}

export interface DevelopmentOptions {
  readonly diameterMm: number;
  readonly fyMpa: number;
  readonly fcMpa: number;
  /** Más de 300 mm de concreto fresco bajo la barra (ψt, ψp = 1.3). */
  readonly topBar: boolean;
  readonly clearSpacingMm: number;
  readonly clearCoverMm: number;
  /** Estribos a lo largo de ld de al menos el mínimo de la norma. */
  readonly minimumStirrups: boolean;
}

export interface DevelopmentLength {
  /** ld con el mínimo de 300 mm. */
  readonly lengthMm: number;
  /** ld calculada sin el mínimo de 300 mm (base de los traslapes). */
  readonly computedMm: number;
  /** Separación y recubrimiento del renglón favorable de la tabla. */
  readonly favorable: boolean;
}

/** Clave de cada comprobación que cita una cláusula. */
export type ReferenceKey =
  | 'flexure' | 'steelMax' | 'steelMin' | 'shear' | 'shearSection' | 'stirrupSpacing' | 'barSpacing' | 'crack'
  | 'deflection' | 'loadFactors' | 'deepBeam' | 'development' | 'hook' | 'splice' | 'beamAnchorage'
  | 'columnStrength' | 'columnRatio' | 'columnBarSpacing' | 'slenderness' | 'sway' | 'tieDiameter' | 'tieSpacing'
  | 'lateralSupport' | 'columnShear' | 'columnShearSection'
  | 'footingDepth' | 'punching' | 'punchingPolar' | 'oneWay' | 'footingFlexure' | 'footingMinSteel' | 'footingSpacing' | 'anchorage';

export interface ColumnRules {
  readonly ratioMin: number;
  readonly ratioMax: number;
  /** Radio de giro de la sección rectangular en la dirección de `depthMm`. */
  radiusOfGyration(depthMm: number): number;
  readonly radiusNote: string;
  /** La esbeltez se compara con kH/r (ACI) o con H/r (NTC 3.3.5.2.1.1). */
  readonly neglectUsesEffectiveLength: boolean;
  /** Tope de 34 − 12 M1/M2. */
  readonly neglectCap: number;
  /** Cota inferior de Cm (−∞ si la norma no la impone). */
  readonly cmMinimum: number;
  /** NTC: excentricidad mínima siempre; ACI: M2,mín = Pu(15 + 0.03h) sólo en miembros esbeltos. */
  readonly minimumMoment: 'eccentricity' | 'aci';
  /** kH/r máximo; `fail` si la norma lo prohíbe, `second-order` si exige análisis de segundo orden. */
  readonly slendernessLimit: { readonly value: number; readonly kind: 'fail' | 'second-order' } | null;
  /** Momento total / primer orden (NSR C.10.10.2.1). */
  readonly secondOrderRatioLimit: number;
  /** kH/r bajo el cual se desprecia la esbeltez en marcos con desplazamiento (−∞: nunca). */
  readonly swayNeglectLimit: number;
  /** NSR C.10.10.1 a: kℓu/r ≤ 22; E.060 10.13.2: menor que 22. */
  readonly swayNeglectInclusive: boolean;
  /** Revisión adicional con δns si H/r ≥ 35/√(Pu/f′cAg) (NTC) o ℓu/r > 35/√(Pu/f′cAg) (E.060). */
  readonly swayIndividualCheck: 'inclusive' | 'strict' | null;
  readonly maximumStabilityIndex: number;
  /** Detallado de estribos: zonas Lo y hx (NTC) o 16db/48de y la regla de 150 mm (ACI). */
  readonly ties: 'ntc' | 'aci';
  minimumTieDiameter(barDiameterMm: number): number;
  /** Separación libre mínima entre barras longitudinales. */
  minimumClearSpacing(barDiameterMm: number, aggregateMm: number): number;
  /** Dimensión mínima y relación de lados de 6.4.2.1.1 (sólo NTC). */
  readonly geometryLimits: boolean;
}

export interface BeamRules {
  maximumSteel(widthMm: number, depthMm: number, extremeDepthMm: number, fcMpa: number, fyMpa: number): number;
  minimumSteel(widthMm: number, depthMm: number, heightMm: number, fcMpa: number, fyMpa: number, extremeDepthMm: number): number;
  readonly maximumSteelNote: string;
  minimumClearSpacing(barDiameterMm: number, aggregateMm: number): number;
  /** Ie de una sección: tabla 13.4.3.2 (NTC), Branson (NSR) o Icr agrietada (E.060). */
  readonly inertia: 'ntc' | 'branson' | 'cracked';
  /** Promedio de claro con un solo extremo continuo: (I1 + 2I3)/3 (NTC, E.060) o (I1 + I3)/2 (NSR). */
  readonly oneEndAverage: 'thirds' | 'halves';
  readonly deflection: 'ntc' | 'aci';
  readonly crack: 'spacing' | 'z';
  /** Viga peraltada: NTC L/h < 5; ACI ℓn ≤ 4h. */
  readonly deepBeam: { readonly ratio: number; readonly inclusive: boolean };
}

export interface FootingRules {
  readonly minimumEffectiveDepthMm: number;
  readonly oneWay: 'ntc' | 'aci';
  /** λs en penetración (NTC 5.6.2.1.1). */
  readonly punchingSizeFactor: boolean;
  readonly minimumSteelRatio: number;
  maximumSpacing(thicknessMm: number): number;
  readonly maximumSpacingNote: string;
  /** Acero mínimo adicional por penetración (NTC 6.7.6.1.2). */
  readonly punchingMinimumSteel: boolean;
}

export interface DesignCode {
  readonly id: DesignCodeId;
  readonly name: string;
  readonly country: string;
  readonly summary: string;
  /** La norma distingue grupos de la construcción en los factores de carga (NTC-CyA). */
  readonly usesStructureGroup: boolean;
  /** La carga viva sostenida se obtiene de W/Wm (NTC-CyA) o se da como fracción. */
  readonly sustainedLive: 'use' | 'fraction';
  loadCombinations(group: StructureGroup): readonly LoadCombination[];
  elasticModulusMpa(fcMpa: number): number;
  ruptureModulusMpa(fcMpa: number): number;
  readonly flexureFactor: FlexureFactor;
  tensionControlledStrain(yieldStrain: number): number;
  /** FR en flexocompresión para un punto del diagrama de interacción. */
  columnFactor(point: { readonly netStrain: number; readonly yieldStrain: number; readonly axialN: number; readonly lowAxialN: number }): number;
  /** E.060: φPn por debajo de min(0.1f′cAg, φPb) aumenta φ hasta 0.90. */
  readonly axialTransition: boolean;
  readonly compressionFactor: number;
  /** Coeficiente de φPn,máx (1.0 NTC, 0.75 NSR, 0.80 E.060). */
  readonly maximumAxialCoefficient: number;
  readonly shearFactor: number;
  twoWayShearFactor(seismic: boolean): number;
  readonly beam: BeamRules;
  readonly column: ColumnRules;
  readonly footing: FootingRules;
  developmentLength(options: DevelopmentOptions): DevelopmentLength;
  hookedDevelopmentMm(diameterMm: number, fyMpa: number, fcMpa: number): number;
  spliceLengthMm(development: DevelopmentLength): number;
  readonly refs: Readonly<Record<ReferenceKey, ClauseReference>>;
}

const SMALL_BAR_MM = 19.1;
const balancedSteel = (b: number, d: number, fc: number, fy: number) =>
  equivalentBlockStrengthMpa(fc) / fy * (600 * betaOne(fc) / (fy + 600)) * b * d;

/** Barras con gancho estándar: 0.24 fy/(λ√f′c) db ≥ 8db y 150 mm, con ψ = 1 (del lado seguro). */
const hooked = (db: number, fy: number, fc: number) => Math.max(0.24 * fy / Math.sqrt(Math.min(fc, 70)) * db, 8 * db, 150);
/** Traslape Clase B: 1.3 ld calculada, no menor que 300 mm. */
const classB = (development: DevelopmentLength) => Math.max(1.3 * development.computedMm, 300);

/** Renglón favorable de la tabla de desarrollo (NTC 14.4.2.4, NSR C.12.2.2, E.060 tabla 12.1). */
const favorableRow = (o: DevelopmentOptions) =>
  o.clearCoverMm >= o.diameterMm && (o.clearSpacingMm >= 2 * o.diameterMm || (o.clearSpacingMm >= o.diameterMm && o.minimumStirrups));

const ntcStructureCombination = (group: StructureGroup): LoadCombination => ({
  label: `${LOAD_FACTORS[group].dead} CM + ${LOAD_FACTORS[group].live} CV (Grupo ${group})`,
  dead: LOAD_FACTORS[group].dead,
  favorableDead: LOAD_FACTORS.favorable,
  live: LOAD_FACTORS[group].live,
});

const NTC_2023: DesignCode = {
  id: 'ntc-2023',
  name: 'NTC-CDMX 2023',
  country: 'México',
  summary: 'Normas Técnicas Complementarias de la Ciudad de México 2023 (concreto y criterios y acciones).',
  usesStructureGroup: true,
  sustainedLive: 'use',
  loadCombinations: (group) => [ntcStructureCombination(group)],
  elasticModulusMpa: (fc) => classOneConcreteProperties(fc, 'limestone')?.elasticModulusMpa ?? 4_400 * Math.sqrt(fc),
  ruptureModulusMpa: (fc) => classOneConcreteProperties(fc, 'limestone')?.meanFlexuralTensileStrengthMpa ?? 0.63 * Math.sqrt(fc),
  flexureFactor: resistanceFactorForStrain,
  tensionControlledStrain: (yieldStrain) => yieldStrain + 0.003,
  columnFactor: ({ netStrain, yieldStrain }) => resistanceFactorForStrain(netStrain, yieldStrain),
  axialTransition: false,
  compressionFactor: 0.65,
  maximumAxialCoefficient: 1,
  shearFactor: 0.75,
  twoWayShearFactor: (seismic) => seismic ? 0.65 : 0.75,
  beam: {
    maximumSteel: (b, d, _dt, fc, fy) => 0.9 * balancedSteel(b, d, fc, fy),
    minimumSteel: (b, d, _h, fc, fy) => Math.max(0.25 * Math.sqrt(fc) / fy, 1.4 / fy) * b * d,
    maximumSteelNote: '0.9 del acero balanceado.',
    minimumClearSpacing: (db, aggregate) => Math.max(25, db, 1.5 * aggregate),
    inertia: 'ntc',
    oneEndAverage: 'thirds',
    deflection: 'ntc',
    crack: 'spacing',
    deepBeam: { ratio: 5, inclusive: false },
  },
  column: {
    ratioMin: 0.01,
    ratioMax: 0.06,
    radiusOfGyration: (depth) => depth / Math.sqrt(12),
    radiusNote: 'r = h/√12 de la sección bruta',
    neglectUsesEffectiveLength: false,
    neglectCap: Number.POSITIVE_INFINITY,
    cmMinimum: 0.4,
    minimumMoment: 'eccentricity',
    slendernessLimit: { value: 100, kind: 'second-order' },
    secondOrderRatioLimit: Number.POSITIVE_INFINITY,
    swayNeglectLimit: Number.NEGATIVE_INFINITY,
    swayNeglectInclusive: false,
    swayIndividualCheck: 'inclusive',
    maximumStabilityIndex: Number.POSITIVE_INFINITY,
    ties: 'ntc',
    minimumTieDiameter: (db) => db <= 31.8 + 1e-6 ? 9.5 : 12.7,
    minimumClearSpacing: (db, aggregate) => Math.max(1.5 * db, 1.5 * aggregate, 40),
    geometryLimits: true,
  },
  footing: {
    minimumEffectiveDepthMm: 150,
    oneWay: 'ntc',
    punchingSizeFactor: true,
    minimumSteelRatio: 0.0018,
    maximumSpacing: (h) => Math.min(2 * h, 450),
    maximumSpacingNote: 'menor de 2h y 450 mm en la sección crítica',
    punchingMinimumSteel: true,
  },
  developmentLength: (o) => {
    const favorable = favorableRow(o);
    const small = o.diameterMm <= SMALL_BAR_MM;
    const divisor = favorable ? (small ? 2.1 : 1.7) : (small ? 1.4 : 1.1);
    const psiP = o.topBar ? 1.3 : 1;
    const psiG = o.fyMpa <= 420 * 1.02 ? 1 : o.fyMpa <= 550 ? 1.15 : 1.3;
    const computedMm = o.fyMpa * psiP * psiG / (divisor * Math.sqrt(Math.min(o.fcMpa, 70))) * o.diameterMm;
    return { lengthMm: Math.max(300, computedMm), computedMm, favorable };
  },
  hookedDevelopmentMm: hooked,
  spliceLengthMm: classB,
  refs: {
    flexure: ntc('3.6.1', '5.2.2.1.1.1', '3.8.2.2 (tabla 3.8.2.2)'),
    steelMax: ntc('5.2.1.3.1', '6.3.5.1.1-6.3.5.2.1'),
    steelMin: ntc('6.3.5.1.1-6.3.5.2.1'),
    shear: ntc('5.5.3.1.1-5.5.3.1.2', '5.5.3.6.1-5.5.3.6.2', '3.8.2.1 (tabla 3.8.2.1, incisos b a d)'),
    shearSection: ntc('5.5.2.2'),
    stirrupSpacing: ntc('6.3.7.6.2.2', '6.3.5.4.1-6.3.5.4.4'),
    barSpacing: ntc('14.2.1'),
    crack: ntc('13.6.1-13.6.2.1', '13.6.2 (tabla 13.6.2)'),
    deflection: ntc('13.4.1.1 (límites a y b)', '13.4.2.1-13.4.3.3', '13.4.3.5', '13.4.4.1'),
    loadFactors: ntcActions('3.4.1', '6.1.1'),
    deepBeam: ntc('5.2.1.1.2'),
    development: ntc('14.4.2.1', '14.4.2.4 (tabla 14.4.2.4)', '14.4.2.6 (tabla 14.4.2.6)'),
    hook: ntc('14.4.3.1-14.4.3.2'),
    splice: ntc('14.5.2.1 (tabla 14.5.2.1)'),
    beamAnchorage: ntc('14.4.2.1', '14.4.2.4 (tabla 14.4.2.4)', '14.4.3.1-14.4.3.2'),
    columnStrength: ntc('3.6.1', '3.8.2.2 (tabla 3.8.2.2)', '5.3.2.1', '5.4.1.2'),
    columnRatio: ntc('6.4.3.1.1-6.4.3.2.1'),
    columnBarSpacing: ntc('14.2.3'),
    slenderness: ntc('3.3.5.2.1.1-3.3.5.2.2.1', '3.3.5.2.4.1-3.3.5.2.4.3'),
    sway: ntc('3.3.5.2.2.2 y 3.3.5.2.5.1-3.3.5.2.5.5', '3.3.5.2.4.1-3.3.5.2.4.3'),
    tieDiameter: ntc('14.7.3.2-14.7.3.3'),
    tieSpacing: ntc('14.7.3.2-14.7.3.3'),
    lateralSupport: ntc('6.4.4.4.2.6'),
    columnShear: ntc('5.5.3.1.1-5.5.3.1.2', '6.4.3.1.1-6.4.3.2.1', '6.4.4.4.5.1 (tabla 6.4.4.4.5.1)', '3.8.2.1 (tabla 3.8.2.1, incisos b a d)'),
    columnShearSection: ntc('5.5.2.2'),
    footingDepth: ntc('9.4.6.1'),
    punching: ntc('5.6.1.7-5.6.2.1.1', '5.6.3.1.1', '6.7.4.2.2.2 y 6.7.4.4.2.3', '3.8.2.1 (tabla 3.8.2.1, incisos b a d)'),
    punchingPolar: ntc('6.7.4.4.2.4 (comentario, fig. C6.7.4.4 a)'),
    oneWay: ntc('5.5.3.2.1 y 5.5.3.8.1', '9.4.8.2', '3.8.2.1 (tabla 3.8.2.1, incisos b a d)'),
    footingFlexure: ntc('3.6.1', '5.2.2.1.1.1', '3.8.2.2 (tabla 3.8.2.2)', '9.4.7.2'),
    footingMinSteel: ntc('6.7.6.1.1-6.7.6.1.2', '6.7.4.2.2.3 (tabla 6.7.4.2.2.3)'),
    footingSpacing: ntc('6.7.7.2.2'),
    anchorage: ntc('9.4.3', '14.4.2.1', '14.4.2.4 (tabla 14.4.2.4)', '14.4.3.1-14.4.3.2'),
  },
};

/** φ de C.9.3.2: 0.65 controladas por compresión (εt ≤ εty), 0.90 si εt ≥ 0.005, lineal entre ambos. */
const nsrFlexureFactor: FlexureFactor = (netStrain, yieldStrain) => {
  if (netStrain <= yieldStrain) return 0.65;
  if (netStrain >= 0.005) return 0.9;
  return 0.65 + 0.25 * (netStrain - yieldStrain) / (0.005 - yieldStrain);
};

const ACI_ROW_DEVELOPMENT = (divisors: { favorableSmall: number; favorableLarge: number; otherSmall: number; otherLarge: number }) =>
  (o: DevelopmentOptions): DevelopmentLength => {
    const favorable = favorableRow(o);
    const small = o.diameterMm <= SMALL_BAR_MM;
    const divisor = favorable ? (small ? divisors.favorableSmall : divisors.favorableLarge) : (small ? divisors.otherSmall : divisors.otherLarge);
    const psiT = o.topBar ? 1.3 : 1;
    const computedMm = o.fyMpa * Math.min(psiT, 1.7) / (divisor * Math.sqrt(Math.min(o.fcMpa, 70))) * o.diameterMm;
    return { lengthMm: Math.max(300, computedMm), computedMm, favorable };
  };

const NSR_10: DesignCode = {
  id: 'nsr-10',
  name: 'NSR-10',
  country: 'Colombia',
  summary: 'Reglamento Colombiano de Construcción Sismo Resistente NSR-10, Título C.',
  usesStructureGroup: false,
  sustainedLive: 'fraction',
  // C.9.2.1: U = 1.4D y U = 1.2D + 1.6L; la muerta no se reduce donde favorece en estas combinaciones.
  loadCombinations: () => [
    { label: '1.4 D', dead: 1.4, favorableDead: 1.4, live: 0 },
    { label: '1.2 D + 1.6 L', dead: 1.2, favorableDead: 1.2, live: 1.6 },
  ],
  elasticModulusMpa: (fc) => 4_700 * Math.sqrt(fc),
  ruptureModulusMpa: (fc) => 0.62 * Math.sqrt(fc),
  flexureFactor: nsrFlexureFactor,
  tensionControlledStrain: () => 0.005,
  columnFactor: ({ netStrain, yieldStrain }) => nsrFlexureFactor(netStrain, yieldStrain),
  axialTransition: false,
  compressionFactor: 0.65,
  maximumAxialCoefficient: 0.75,
  shearFactor: 0.75,
  twoWayShearFactor: () => 0.75,
  beam: {
    // C.10.3.5: εt ≥ 0.004 en elementos a flexión.
    maximumSteel: (b, _d, dt, fc, fy) => equivalentBlockStrengthMpa(fc) * betaOne(fc) * (0.003 / (0.003 + 0.004)) * dt * b / fy,
    minimumSteel: (b, d, _h, fc, fy) => Math.max(0.25 * Math.sqrt(fc), 1.4) * b * d / fy,
    maximumSteelNote: 'εt ≥ 0.004 (C.10.3.5).',
    minimumClearSpacing: (db, aggregate) => Math.max(25, db, 4 / 3 * aggregate),
    inertia: 'branson',
    oneEndAverage: 'halves',
    deflection: 'aci',
    crack: 'spacing',
    deepBeam: { ratio: 4, inclusive: true },
  },
  column: {
    ratioMin: 0.01,
    ratioMax: 0.04,
    radiusOfGyration: (depth) => 0.3 * depth,
    radiusNote: 'r = 0.3h (C.10.10.1.2)',
    neglectUsesEffectiveLength: true,
    neglectCap: 40,
    cmMinimum: Number.NEGATIVE_INFINITY,
    minimumMoment: 'aci',
    slendernessLimit: null,
    secondOrderRatioLimit: 1.4,
    swayNeglectLimit: 22,
    swayNeglectInclusive: true,
    swayIndividualCheck: null,
    maximumStabilityIndex: Number.POSITIVE_INFINITY,
    ties: 'aci',
    minimumTieDiameter: (db) => db <= 31.8 + 1e-6 ? 9.5 : 12.7,
    minimumClearSpacing: (db, aggregate) => Math.max(1.5 * db, 40, 4 / 3 * aggregate),
    geometryLimits: false,
  },
  footing: {
    minimumEffectiveDepthMm: 150,
    oneWay: 'aci',
    punchingSizeFactor: false,
    minimumSteelRatio: 0.0018,
    maximumSpacing: (h) => Math.min(3 * h, 450),
    maximumSpacingNote: 'menor de 3h y 450 mm',
    punchingMinimumSteel: false,
  },
  developmentLength: ACI_ROW_DEVELOPMENT({ favorableSmall: 2.1, favorableLarge: 1.7, otherSmall: 1.4, otherLarge: 1.1 }),
  hookedDevelopmentMm: hooked,
  spliceLengthMm: classB,
  refs: {
    flexure: nsr('C.9.3.2.1-C.9.3.2.3', 'C.10.3.3-C.10.3.5', 'C.10.2.7.3'),
    steelMax: nsr('C.10.3.3-C.10.3.5'),
    steelMin: nsr('C.10.5.1'),
    shear: nsr('C.11.2.1.1-C.11.2.1.3', 'C.11.4.6.3', 'C.9.3.2.1-C.9.3.2.3'),
    shearSection: nsr('C.11.4.7.9'),
    stirrupSpacing: nsr('C.11.4.5.1 y C.11.4.5.3'),
    barSpacing: nsr('C.7.6.1 y C.7.6.3', 'C.3.3.2'),
    crack: nsr('C.10.6.4'),
    deflection: nsr('C.9.5.2.3-C.9.5.2.5', 'Tabla C.9.5(b)', 'C.8.5.1'),
    loadFactors: nsr('C.9.2.1'),
    deepBeam: nsr('C.10.7.1'),
    development: nsr('C.12.2.1-C.12.2.2', 'C.12.2.4'),
    hook: nsr('C.12.5.1-C.12.5.2'),
    splice: nsr('C.12.15.1'),
    beamAnchorage: nsr('C.12.2.1-C.12.2.2', 'C.12.2.4', 'C.12.5.1-C.12.5.2'),
    columnStrength: nsr('C.9.3.2.1-C.9.3.2.3', 'C.10.3.3-C.10.3.5', 'C.10.3.6.2', 'CR10.3.6 y CR10.3.7 (comentario)'),
    columnRatio: nsr('C.10.9.1'),
    columnBarSpacing: nsr('C.7.6.1 y C.7.6.3', 'C.3.3.2'),
    slenderness: nsr('C.10.10.1 y C.10.10.1.2', 'C.10.10.6-C.10.10.6.5', 'C.10.10.2.1'),
    sway: nsr('C.10.10.7-C.10.10.7.3', 'C.10.10.1 y C.10.10.1.2', 'C.10.10.2.1'),
    tieDiameter: nsr('C.7.10.5.1-C.7.10.5.3'),
    tieSpacing: nsr('C.7.10.5.1-C.7.10.5.3', 'C.11.4.5.1 y C.11.4.5.3'),
    lateralSupport: nsr('C.7.10.5.1-C.7.10.5.3'),
    columnShear: nsr('C.11.2.1.1-C.11.2.1.3', 'C.11.4.5.1 y C.11.4.5.3', 'C.11.4.6.3', 'C.9.3.2.1-C.9.3.2.3'),
    columnShearSection: nsr('C.11.4.7.9'),
    footingDepth: nsr('C.15.7'),
    punching: nsr('C.11.11.1.2', 'C.11.11.2.1', 'C.11.11.7.1 y C.13.5.3.2', 'C.9.3.2.1-C.9.3.2.3'),
    punchingPolar: nsr('CR11.11.7.2 (comentario)'),
    oneWay: nsr('C.11.2.1.1-C.11.2.1.3', 'C.15.5.2 y C.11.1.3.1', 'C.9.3.2.1-C.9.3.2.3'),
    footingFlexure: nsr('C.15.4.2 y C.15.4.4.2', 'C.9.3.2.1-C.9.3.2.3', 'C.10.2.7.3'),
    footingMinSteel: nsr('C.10.5.4 y C.7.12.2.1'),
    footingSpacing: nsr('C.10.5.4 y C.7.12.2.1'),
    anchorage: nsr('C.12.2.1-C.12.2.2', 'C.12.2.4', 'C.12.5.1-C.12.5.2'),
  },
};

/** E.060 12.2: renglón favorable de la tabla 12.1; en otros casos la ec. 12-1 con Ktr = 0 y (cb + Ktr)/db ≤ 2.5. */
const e060Development = (o: DevelopmentOptions): DevelopmentLength => {
  const favorable = favorableRow(o);
  const small = o.diameterMm <= SMALL_BAR_MM;
  const psiT = o.topBar ? 1.3 : 1;
  const root = Math.sqrt(Math.min(o.fcMpa, 70));
  let computedMm: number;
  if (favorable) {
    computedMm = o.fyMpa * Math.min(psiT, 1.7) / ((small ? 2.6 : 2.1) * root) * o.diameterMm;
  } else {
    const cb = Math.min(o.clearCoverMm + o.diameterMm / 2, (o.clearSpacingMm + o.diameterMm) / 2);
    const confinement = Math.min(2.5, cb / o.diameterMm);
    const psiS = small ? 0.8 : 1;
    computedMm = o.fyMpa / (1.1 * root) * (Math.min(psiT, 1.7) * psiS / confinement) * o.diameterMm;
  }
  return { lengthMm: Math.max(300, computedMm), computedMm, favorable };
};

const E060: DesignCode = {
  id: 'e060',
  name: 'E.060 (2009)',
  country: 'Perú',
  summary: 'Norma Técnica E.060 Concreto Armado del Reglamento Nacional de Edificaciones.',
  usesStructureGroup: false,
  sustainedLive: 'fraction',
  loadCombinations: () => [{ label: '1.4 CM + 1.7 CV', dead: 1.4, favorableDead: 1.4, live: 1.7 }],
  elasticModulusMpa: (fc) => 4_700 * Math.sqrt(fc),
  ruptureModulusMpa: (fc) => 0.62 * Math.sqrt(fc),
  // 9.3.2.1: flexión sin carga axial 0.90 sin transición (el acero máximo es 0.75Asb).
  flexureFactor: () => 0.9,
  tensionControlledStrain: (yieldStrain) => yieldStrain,
  // 9.3.2.2: tracción 0.90; compresión 0.70 y lineal hasta 0.90 cuando φPn baja de min(0.1f′cAg, φPb) a cero.
  columnFactor: ({ axialN, lowAxialN }) => axialN <= 0 ? 0.9 : Math.max(0.7, Math.min(0.9, 0.9 / (1 + 0.2 * axialN / lowAxialN))),
  axialTransition: true,
  compressionFactor: 0.7,
  maximumAxialCoefficient: 0.8,
  shearFactor: 0.85,
  twoWayShearFactor: () => 0.85,
  beam: {
    maximumSteel: (b, d, _dt, fc, fy) => 0.75 * balancedSteel(b, d, fc, fy),
    // 10.5.1 y 10.5.2: φMn ≥ 1.2Mcr y As ≥ 0.22√f′c bw d/fy.
    minimumSteel: (b, d, h, fc, fy, dt) => {
      const crackingKnm = 0.62 * Math.sqrt(fc) * b * h ** 2 / 6 / 1e6;
      const forCracking = requiredFlexuralSteelMm2(1.2 * crackingKnm, b, d, fy, fc, dt, () => 0.9, (yieldStrain) => yieldStrain) ?? Number.POSITIVE_INFINITY;
      return Math.max(0.22 * Math.sqrt(fc) * b * d / fy, forCracking);
    },
    maximumSteelNote: '0.75 del acero balanceado (10.3.4).',
    minimumClearSpacing: (db, aggregate) => Math.max(25, db, 4 / 3 * aggregate),
    inertia: 'cracked',
    oneEndAverage: 'thirds',
    deflection: 'aci',
    crack: 'z',
    deepBeam: { ratio: 4, inclusive: true },
  },
  column: {
    ratioMin: 0.01,
    ratioMax: 0.06,
    radiusOfGyration: (depth) => 0.3 * depth,
    radiusNote: 'r = 0.3h (10.11.2)',
    neglectUsesEffectiveLength: true,
    neglectCap: 40,
    cmMinimum: 0.4,
    minimumMoment: 'aci',
    slendernessLimit: { value: 100, kind: 'fail' },
    secondOrderRatioLimit: Number.POSITIVE_INFINITY,
    swayNeglectLimit: 22,
    swayNeglectInclusive: false,
    swayIndividualCheck: 'strict',
    maximumStabilityIndex: 0.6,
    ties: 'aci',
    // 7.10.5.1: 8 mm hasta 5/8", 3/8" hasta 1", 1/2" para barras mayores.
    minimumTieDiameter: (db) => db <= 15.9 + 1e-6 ? 8 : db <= 25.4 + 1e-6 ? 9.5 : 12.7,
    minimumClearSpacing: (db, aggregate) => Math.max(1.5 * db, 40, 4 / 3 * aggregate),
    geometryLimits: false,
  },
  footing: {
    minimumEffectiveDepthMm: 300,
    oneWay: 'aci',
    punchingSizeFactor: false,
    minimumSteelRatio: 0.0018,
    maximumSpacing: (h) => Math.min(3 * h, 400),
    maximumSpacingNote: 'menor de 3h y 400 mm',
    punchingMinimumSteel: false,
  },
  developmentLength: e060Development,
  hookedDevelopmentMm: hooked,
  spliceLengthMm: classB,
  refs: {
    flexure: e060('9.3.2.1-9.3.2.3', '10.2.7.3'),
    steelMax: e060('10.3.4'),
    steelMin: e060('10.5.1-10.5.2'),
    shear: e060('11.3.1.1-11.3.1.2', '11.5.6.2', '9.3.2.1-9.3.2.3'),
    shearSection: e060('11.5.7.9'),
    stirrupSpacing: e060('11.5.5.1 y 11.5.5.3'),
    barSpacing: e060('7.6.1 y 7.6.3', '3.3.2'),
    crack: e060('9.9.3'),
    deflection: e060('9.6.2.3-9.6.2.5', 'Tabla 9.2', '8.5.2'),
    loadFactors: e060('9.2.1'),
    deepBeam: e060('10.7.1'),
    development: e060('12.2.1-12.2.3 (tabla 12.1)', 'Tabla 12.2'),
    hook: e060('12.5.1-12.5.2'),
    splice: e060('12.15.1'),
    beamAnchorage: e060('12.2.1-12.2.3 (tabla 12.1)', 'Tabla 12.2', '12.5.1-12.5.2'),
    columnStrength: e060('9.3.2.1-9.3.2.3', '10.3.6.2', '10.18'),
    columnRatio: e060('10.9.1'),
    columnBarSpacing: e060('7.6.1 y 7.6.3', '3.3.2'),
    slenderness: e060('10.11.2 y 10.11.5', '10.12.1-10.12.3.2'),
    sway: e060('10.13.1-10.13.6', '10.11.2 y 10.11.5', '10.12.1-10.12.3.2'),
    tieDiameter: e060('7.10.5.1-7.10.5.3'),
    tieSpacing: e060('7.10.5.1-7.10.5.3', '11.5.5.1 y 11.5.5.3'),
    lateralSupport: e060('7.10.5.1-7.10.5.3'),
    columnShear: e060('11.3.1.1-11.3.1.2', '11.5.5.1 y 11.5.5.3', '11.5.6.2', '9.3.2.1-9.3.2.3'),
    columnShearSection: e060('11.5.7.9'),
    footingDepth: e060('15.7'),
    punching: e060('11.12.1.2', '11.12.2.1', '11.12.6.1 y 13.5.3.1', '9.3.2.1-9.3.2.3'),
    punchingPolar: complementary('Jc de sección rectangular (la E.060 no da la expresión)'),
    oneWay: e060('11.3.1.1-11.3.1.2', '15.5.2 y 11.1.3.1', '9.3.2.1-9.3.2.3'),
    footingFlexure: e060('15.4.2 y 15.4.4.2', '9.3.2.1-9.3.2.3', '10.2.7.3'),
    footingMinSteel: e060('10.5.4 y 9.7.2'),
    footingSpacing: e060('10.5.4 y 9.7.2'),
    anchorage: e060('12.2.1-12.2.3 (tabla 12.1)', 'Tabla 12.2', '12.5.1-12.5.2'),
  },
};

const DESIGN_CODES: Readonly<Record<DesignCodeId, DesignCode>> = Object.freeze({
  'ntc-2023': NTC_2023,
  'nsr-10': NSR_10,
  e060: E060,
});

export const designCode = (id: DesignCodeId): DesignCode => DESIGN_CODES[id];
