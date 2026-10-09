import { describe, expect, it } from 'vitest';
import { designCode } from './codes';
import { designStrapFooting, type StrapFootingInput } from './strapFooting';

const base: StrapFootingInput = {
  code: 'ntc-2023',
  exterior: { widthMm: 400, depthMm: 400, deadKn: 500, liveKn: 200 },
  interior: { widthMm: 400, depthMm: 400, deadKn: 800, liveKn: 300 },
  spacingMm: 5000, combinations: designCode('ntc-2023').loadCombinations('B'), allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420,
  coverMm: 75, exteriorLengthMm: null, thicknessMm: null, barDiameterMm: 15.9,
  strap: { widthMm: null, heightMm: null, barDiameterMm: 15.9, stirrupDiameterMm: 9.5 },
};

const ok = (result: ReturnType<typeof designStrapFooting>) => {
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};

describe('zapata de lindero con contratrabe', () => {
  const result = ok(designStrapFooting(base));

  it('equilibra la excentricidad: R1 = P1·L/(L − e) y R2 = P2 − P1·e/(L − e)', () => {
    // B1 = 1650 mm con W1 ≈ 2B1: e = 1650/2 − 400/2 = 625 mm.
    expect(result.exteriorLengthMm).toBe(1650);
    expect(result.eccentricityMm).toBe(625);
    const k = 5000 / (5000 - 625);
    expect(result.reactions.service.exteriorKn).toBeCloseTo(700 * k, 9);
    expect(result.reactions.service.interiorKn).toBeCloseTo(1100 - 700 * (k - 1), 9);
    expect(result.reactions.minimumInteriorKn).toBeCloseTo(800 - 700 * (k - 1), 9);
    // W1 = R1/(qa·B1) redondeado a 50 mm.
    expect(result.exteriorWidthMm).toBe(3250);
    expect(result.exterior.servicePressureKpa).toBeLessThanOrEqual(150);
  });

  it('da el momento negativo máximo de la contratrabe donde el cortante se anula', () => {
    const p1u = 1.3 * 500 + 1.5 * 200;
    const r1u = p1u * 5000 / (5000 - 625);
    const zero = p1u * 1650 / r1u;
    const minimum = Math.min(...result.diagram.momentKnm);
    expect(minimum).toBeCloseTo(p1u * (200 - zero / 2) / 1e3, 6);
    expect(result.strap.negativeAtMm).toBeCloseTo(zero, 6);
    expect(result.strap.top.momentKnm).toBeCloseTo(-minimum, 9);
    // En la columna 2 el momento se anula y el cortante del tramo libre es R1u − P1u.
    expect(result.diagram.momentKnm.at(-1)).toBeCloseTo(0, 6);
    expect(result.diagram.shearKn.at(-1)).toBeCloseTo(r1u - p1u, 6);
  });

  it('propaga la advertencia complementaria cuando la contratrabe usa menos de 9.5 mm', () => {
    const small = ok(designStrapFooting({ ...base, strap: { ...base.strap, stirrupDiameterMm: 6.4 } }));
    const warning = small.checks.find((check) => check.id === 'stirrup-diameter-scope');
    expect(warning?.status).toBe('warning');
    expect(warning?.label).toBe('Contratrabe: diámetro de estribo');
    expect(warning?.reference.standard).toBe('complementary');
    expect(small.status).toBe('warning');
    expect(small.checks.find((check) => check.id === 'strap-stirrups')?.status).not.toBe('fail');
  });

  it('cumple 9.5.1.1 y 9.5.1.2 de la NTC en la contratrabe', () => {
    const clear = 5000 - 400;
    expect(Math.min(result.strap.widthMm, result.strap.heightMm)).toBeGreaterThanOrEqual(Math.max(450, clear / 20));
    expect(result.strap.shear.maximumSpacingMm).toBeLessThanOrEqual(Math.min(Math.min(result.strap.widthMm, result.strap.heightMm) / 2, 300));
    for (const id of ['strap-dimension', 'strap-flexure-top', 'strap-shear', 'strap-stirrups', 'strap-balance', 'strap-gap']) {
      expect(result.checks.find((check) => check.id === id)!.status).toBe('pass');
    }
    expect(result.status).not.toBe('fail');
  });

  it('diseña la zapata 2 con P2 completa y avisa si la columna 2 no equilibra', () => {
    expect(result.interior.input.deadKn).toBe(800);
    const light = ok(designStrapFooting({ ...base, interior: { ...base.interior, deadKn: 50, liveKn: 10 }, exteriorLengthMm: 2400, spacingMm: 3000 }));
    expect(light.checks.find((check) => check.id === 'strap-balance')!.status).toBe('fail');
  });

  it('con NSR-10 no aplica la dimensión mínima de la NTC', () => {
    const nsr = ok(designStrapFooting({ ...base, code: 'nsr-10', combinations: designCode('nsr-10').loadCombinations('B') }));
    expect(nsr.checks.some((check) => check.id === 'strap-dimension')).toBe(false);
  });
});
