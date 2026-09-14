export const NTC_CONCRETE_2023 = Object.freeze({
  standardId: 'ntc-cdmx-2023-concrete',
  sourceUrl: 'https://data.consejeria.cdmx.gob.mx/portal_old/uploads/gacetas/b3c4f4ff37241d0a93cc6742a8b0bf2f.pdf',
  sourceSha256: '293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a',
  flexureResistanceFactor: 0.9,
  shearResistanceFactor: 0.75,
  minimumLongitudinalBarDiameterMm: 12.7,
  implementedClauseIds: Object.freeze([
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

export function betaOne(compressiveStrengthMpa: number): number {
  return compressiveStrengthMpa <= 30
    ? 0.85
    : Math.max(0.65, 1.05 - compressiveStrengthMpa / 140);
}

export function equivalentBlockStrengthMpa(compressiveStrengthMpa: number): number {
  return 0.85 * compressiveStrengthMpa;
}
