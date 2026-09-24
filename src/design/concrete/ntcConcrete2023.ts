export const NTC_CONCRETE_2023 = Object.freeze({
  standardId: 'ntc-cdmx-2023-concrete',
  sourceUrl: 'https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf',
  sourceSha256: '293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a',
  flexureResistanceFactor: 0.9,
  shearResistanceFactor: 0.75,
  minimumLongitudinalBarDiameterMm: 12.7,
  implementedClauseIds: Object.freeze([
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
  ]),
});

/**
 * El cambio de régimen se toma en 28 MPa, no en 30.
 *
 * La ec. 3.6.1 de la NTC 2023 escribe β1 = 0.85 hasta f'c = 30 MPa y
 * `1.05 - f'c/140` arriba (extracto registrado en la cláusula 3.6.1), lo que deja
 * un salto de 0.85 a 0.836 en 30 MPa. La rama `1.05 - f'c/140` es la forma
 * algebraica de `0.85 - 0.05 (f'c - 28) / 7` y vale exactamente 0.85 en 28 MPa
 * (así lo escriben NSR-10 C.10.2.7.3 y E.060 10.2.7.3): con el umbral en 28 la
 * función es continua y, entre 28 y 30 MPa, da un β1 menor que el literal de la
 * NTC, es decir, menos área balanceada, menos `As_max` y menor εt: del lado seguro.
 */
export const BETA_ONE_PLATEAU_LIMIT_MPA = 28;

export function betaOne(compressiveStrengthMpa: number): number {
  return compressiveStrengthMpa <= BETA_ONE_PLATEAU_LIMIT_MPA
    ? 0.85
    : Math.max(0.65, 1.05 - compressiveStrengthMpa / 140);
}

export function equivalentBlockStrengthMpa(compressiveStrengthMpa: number): number {
  return 0.85 * compressiveStrengthMpa;
}

export interface NtcConcreteClassOneProperties {
  readonly elasticModulusMpa: number;
  readonly meanFlexuralTensileStrengthMpa: number;
  readonly basis: 'ntc-table-2.2.1-class-1a-limestone' | 'ntc-table-2.2.1-class-1a-basalt' | 'ntc-table-2.2.1-class-1b-limestone' | 'ntc-table-2.2.1-class-1b-basalt';
}

export function classOneConcreteProperties(
  compressiveStrengthMpa: number,
  coarseAggregate: 'limestone' | 'basalt',
): NtcConcreteClassOneProperties | undefined {
  if (compressiveStrengthMpa < 25 || compressiveStrengthMpa > 70) return undefined;
  const root = Math.sqrt(compressiveStrengthMpa);
  if (compressiveStrengthMpa < 40) {
    return {
      elasticModulusMpa: (coarseAggregate === 'limestone' ? 4_400 : 3_500) * root,
      meanFlexuralTensileStrengthMpa: 0.63 * root,
      basis: `ntc-table-2.2.1-class-1a-${coarseAggregate}`,
    };
  }
  return {
    elasticModulusMpa: 2_700 * root + (coarseAggregate === 'limestone' ? 11_000 : 5_000),
    meanFlexuralTensileStrengthMpa: (coarseAggregate === 'limestone' ? 0.85 : 0.80) * root,
    basis: `ntc-table-2.2.1-class-1b-${coarseAggregate}`,
  };
}
