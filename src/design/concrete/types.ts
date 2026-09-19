export type ConcreteDesignBlocker =
  | 'catalog-section-required'
  | 'catalog-material-required'
  | 'reliable-analysis-required'
  | 'traceable-ultimate-combination-required'
  | 'traceable-service-combination-required'
  | 'complete-normative-evidence-required'
  | 'unsupported-v1-input'
  | 'invalid-input'
  | 'no-longitudinal-arrangement'
  | 'no-stirrup-arrangement';

export interface ConcreteCombinationReference {
  id: string;
  stateLimit: 'ultimate' | 'service';
  jurisdiction: string;
  edition: string;
  sourceUrl: string;
}

export interface ConcreteBeamDesignInput {
  standardId: string;
  memberId: string;
  analysisId: string;
  spanMm: number;
  section: {
    catalogId: string;
    origin: 'catalog' | 'custom';
    shape: 'rectangular';
    widthMm: number;
    heightMm: number;
  };
  concrete: {
    catalogId: string;
    origin: 'catalog' | 'custom';
    density: 'normal' | 'lightweight';
    coarseAggregate: 'limestone' | 'basalt';
    compressiveStrengthMpa: number;
  };
  reinforcement: {
    coverMm: number;
    maximumAggregateSizeMm: number;
    longitudinalYieldStrengthMpa: number;
    stirrupYieldStrengthMpa: number;
    steelElasticModulusMpa: number;
    preferredLongitudinalDiametersMm: number[];
    preferredStirrupDiametersMm: number[];
    stirrupLegs: number;
    stirrupSpacingIncrementMm: number;
  };
  system: { ductility: 'low' | 'high'; prestressed: boolean };
  analysis: {
    reliability: 'reliable' | 'limited' | 'unreliable';
    ultimate: {
      combination: ConcreteCombinationReference;
      positiveMomentKnm: number;
      negativeMomentKnm: number;
      absoluteShearKn: number;
      compressionKn: number;
    };
    service: {
      combination: ConcreteCombinationReference;
      governingMomentKnm: number;
      grossElasticDeflectionMm: number;
      /** Elastic modulus used by the solver for grossElasticDeflectionMm. */
      grossElasticModulusMpa: number;
      damagesNonstructuralElements: boolean;
    };
  };
  normativeEvidence?: {
    sourceUrl: string;
    sourceSha256: string;
    verifiedClauseIds: string[];
  };
}

export type ConcreteDesignCheckId =
  | 'flexure-positive'
  | 'flexure-negative'
  | 'minimum-steel-positive'
  | 'maximum-steel-positive'
  | 'minimum-steel-negative'
  | 'maximum-steel-negative'
  | 'shear-strength'
  | 'maximum-shear-dimension'
  | 'minimum-stirrup-ratio'
  | 'stirrup-longitudinal-spacing'
  | 'stirrup-transverse-spacing'
  | 'bar-clear-spacing-positive'
  | 'bar-crack-spacing-positive'
  | 'bar-clear-spacing-negative'
  | 'bar-crack-spacing-negative'
  | 'total-service-deflection';

export interface ConcreteDesignCheck {
  readonly id: ConcreteDesignCheckId;
  readonly status: 'pass' | 'fail' | 'not-evaluated';
  readonly clauseIds: readonly string[];
  readonly demand?: { readonly value: number; readonly unit: string };
  readonly capacity?: { readonly value: number; readonly unit: string };
  readonly message: string;
}

export interface LongitudinalArrangement {
  readonly diameterMm: number;
  readonly count: number;
  readonly areaMm2: number;
  readonly effectiveDepthMm: number;
  readonly clearSpacingMm: number;
  readonly minimumClearSpacingMm: number;
  readonly centerSpacingMm: number;
  readonly maximumCrackControlSpacingMm: number;
}

export interface ConcreteBeamDesignAvailable {
  readonly status: 'available';
  readonly scope: 'complete-within-v1';
  readonly memberId: string;
  readonly binding: {
    readonly analysisId: string;
    readonly memberId: string;
    readonly ultimateCombinationId: string;
    readonly serviceCombinationId: string;
  };
  readonly flexure: {
    readonly positive: { readonly demandKnm: number; readonly requiredAreaMm2: number; readonly designStrengthKnm: number };
    readonly negative: { readonly demandKnm: number; readonly requiredAreaMm2: number; readonly designStrengthKnm: number };
  };
  readonly reinforcement: {
    readonly rejectedLongitudinalDiameters: readonly { readonly diameterMm: number; readonly reason: 'below-ntc-number-4-diameter' }[];
    readonly bottom: LongitudinalArrangement;
    readonly top: LongitudinalArrangement;
    readonly stirrups: {
      readonly diameterMm: number;
      readonly legs: number;
      readonly spacingMm: number;
      readonly requiredAreaPerSpacingMm: number;
      readonly providedAreaPerSpacingMm: number;
      readonly concreteDesignStrengthKn: number;
      readonly designStrengthKn: number;
      readonly maximumLongitudinalSpacingMm: number;
      readonly transverseLegSpacingMm: number;
      readonly maximumTransverseLegSpacingMm: number;
    };
  };
  readonly service: {
    readonly meanFlexuralTensileStrengthMpa: number;
    readonly concreteElasticModulusMpa: number;
    readonly concretePropertyBasis: 'ntc-table-2.2.1-class-1a-limestone' | 'ntc-table-2.2.1-class-1a-basalt' | 'ntc-table-2.2.1-class-1b-limestone' | 'ntc-table-2.2.1-class-1b-basalt';
    readonly grossInertiaMm4: number;
    readonly crackedTransformedInertiaMm4: number;
    readonly effectiveInertiaMm4: number;
    readonly immediateDeflectionMm: number;
    readonly totalDeflectionLimitMm: number;
    readonly totalConclusion: 'not-evaluated';
  };
  readonly checks: readonly ConcreteDesignCheck[];
  readonly warnings: readonly string[];
  readonly notEvaluated: readonly {
    readonly id: 'refined-cracking' | 'creep' | 'shrinkage' | 'long-term-deflection';
    readonly reason: string;
  }[];
  readonly provenance: {
    readonly standardId: string;
    readonly sourceUrl: string;
    readonly sourceSha256: string;
    readonly clauseIds: readonly string[];
  };
}

export interface ConcreteBeamDesignBlocked {
  readonly status: 'blocked';
  readonly scope: 'incomplete';
  readonly memberId: string;
  readonly blockers: readonly ConcreteDesignBlocker[];
}

export type ConcreteBeamDesignOutcome = ConcreteBeamDesignAvailable | ConcreteBeamDesignBlocked;
