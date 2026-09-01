import { translatePhase2, type Phase2TranslationKey } from '../i18n/phase2Catalogs';

/** Magnitudes que una propuesta externa puede escribir en una barra. */
export type ProposalQuantityKind = 'elasticModulus' | 'area' | 'inertia' | 'density';

export interface ProposalQuantity {
  value: number;
  unit: string;
}

/**
 * Factores hacia las unidades base del motor. La lista es cerrada: una unidad
 * desconocida se rechaza y nunca se interpreta por parecido.
 */
const FACTORS: Record<ProposalQuantityKind, Readonly<Record<string, number>>> = {
  // E se guarda en kN/m². 1 MPa = 1000 kN/m².
  elasticModulus: {
    Pa: 1e-3,
    kPa: 1,
    MPa: 1e3,
    GPa: 1e6,
    psi: 6.894757293168361e-3,
    ksi: 6.894757293168361,
  },
  area: { m2: 1, cm2: 1e-4, mm2: 1e-6, in2: 6.4516e-4 },
  inertia: { m4: 1, cm4: 1e-8, mm4: 1e-12, in4: 4.162314256e-7 },
  density: { 'kg/m3': 1, 'lb/ft3': 16.018463373960142 },
};

export const allowedUnits = (kind: ProposalQuantityKind): string[] => Object.keys(FACTORS[kind]);

export class ProposalUnitError extends Error {
  readonly key: Phase2TranslationKey;
  readonly params: Record<string, string | number> | undefined;

  constructor(key: Phase2TranslationKey, params?: Record<string, string | number>) {
    super(translatePhase2('es', key, params));
    this.name = 'ProposalUnitError';
    this.key = key;
    this.params = params;
  }
}

/** Convierte una cantidad declarada a la unidad base de su magnitud. */
export const toBaseUnits = (quantity: ProposalQuantity, kind: ProposalQuantityKind): number => {
  if (!Number.isFinite(quantity.value)) {
    throw new ProposalUnitError('proposal.error.quantityNotFinite');
  }
  const factor = FACTORS[kind][quantity.unit];
  if (factor === undefined) {
    throw new ProposalUnitError('proposal.error.unitNotAllowed', {
      unit: quantity.unit,
      kind,
      allowed: allowedUnits(kind).join(', '),
    });
  }
  return quantity.value * factor;
};
