import { describe, expect, it } from 'vitest';
import { designCode } from './codes';
import { designFooting, type FootingDesignInput } from './footing';

const base: FootingDesignInput = {
  code: 'ntc-2023', columnWidthMm: 400, columnDepthMm: 400, deadKn: 600, liveKn: 300, combinations: designCode('ntc-2023').loadCombinations('B'),
  serviceMomentXKnm: 0, serviceMomentYKnm: 0, ultimateMomentXKnm: 0, ultimateMomentYKnm: 0,
  allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420, thicknessMm: 500, sideXMm: null, sideYMm: null, coverMm: 75, barDiameterMm: 15.9,
  seismicCombination: false,
};

const ok = (result: ReturnType<typeof designFooting>) => {
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};
const check = (result: ReturnType<typeof ok>, id: string) => result.checks.find((item) => item.id === id)!;

describe('transmisión columna–zapata (NTC 5.9 y 6.10.3)', () => {
  it('limita √(A2/A1) a 2 con la pirámide 1:2 dentro de la zapata', () => {
    const result = ok(designFooting(base));
    expect(result.sideXMm).toBe(2450);
    const [bearing] = result.bearing;
    // Margen = min((2450 − 400)/2, 2h = 1000) → A2 = 2400², √(A2/A1) = 6 → 2.
    expect(bearing!.supportAreaMm2).toBeCloseTo(2400 ** 2, 6);
    expect(bearing!.lowerStrengthKn).toBeCloseTo(0.65 * 0.85 * 25 * 160_000 * 2 / 1e3, 6);
    expect(bearing!.upperStrengthKn).toBeCloseTo(0.65 * 0.85 * 25 * 160_000 / 1e3, 6);
    expect(bearing!.dowelMinimumMm2).toBeCloseTo(0.005 * 160_000, 9);
    expect(bearing!.dowelExcessMm2).toBe(0);
    expect(check(result, 'crushing-column-footing').status).toBe('pass');
    expect(check(result, 'dowels-column-footing').status).toBe('info');
  });

  it('manda el excedente sobre el aplastamiento a las barras de la interfaz', () => {
    const result = ok(designFooting({ ...base, deadKn: 2000, liveKn: 1000, columnFcMpa: 20, thicknessMm: 900 }));
    const [bearing] = result.bearing;
    const strength = 0.65 * 0.85 * 20 * 160_000 / 1e3;
    expect(bearing!.upperStrengthKn).toBeCloseTo(strength, 6);
    expect(bearing!.dowelExcessMm2).toBeCloseTo((result.ultimateAxialKn - strength) * 1e3 / (0.65 * 420), 6);
    expect(check(result, 'crushing-column-footing').status).toBe('warning');
  });
});

describe('zapata con columna circular', () => {
  const diameter = 450;
  const square = diameter * Math.sqrt(Math.PI) / 2;

  it('NTC: flexión a D/10 dentro del paño y penetración con la cuadrada de igual área', () => {
    const result = ok(designFooting({ ...base, columnShape: 'circular', columnWidthMm: diameter, columnDepthMm: diameter }));
    expect(result.support.flexureWidthMm).toBeCloseTo(0.8 * diameter, 9);
    expect(result.support.shearWidthMm).toBeCloseTo(square, 9);
    const q0 = result.ultimateAxialKn * 1e3 / (result.sideXMm * result.sideYMm);
    const arm = result.sideXMm / 2 - 0.4 * diameter;
    expect(result.directions.x.momentKnm).toBeCloseTo(result.sideYMm * q0 * arm ** 2 / 2 / 1e6, 6);
    expect(result.punching.perimeterMm).toBeCloseTo(4 * (square + result.effectiveDepthMm), 6);
    expect(result.bearing[0]!.loadedAreaMm2).toBeCloseTo(Math.PI * diameter ** 2 / 4, 6);
    expect(check(result, 'flexure-x').reference.clauseIds).toContain('9.4.7.4 (tabla 9.4.7.4)');
    expect(check(result, 'punching').reference.clauseIds).toContain('9.4.9.3.2');
  });

  it('NSR-10: la cuadrada de igual área también para flexión', () => {
    const result = ok(designFooting({ ...base, code: 'nsr-10', combinations: designCode('nsr-10').loadCombinations('B'), columnShape: 'circular', columnWidthMm: diameter, columnDepthMm: diameter }));
    expect(result.support.flexureWidthMm).toBeCloseTo(square, 9);
  });
});

describe('zapata con dado', () => {
  const pedestal = { widthMm: 600, depthMm: 600, heightMm: 800 };

  it('revisa la zapata con el dado y el aplastamiento en ambas interfaces', () => {
    const result = ok(designFooting({ ...base, pedestal }));
    expect(result.support.kind).toBe('pedestal');
    expect(result.punching.perimeterMm).toBeCloseTo(4 * (600 + result.effectiveDepthMm), 6);
    const [top, bottom] = result.bearing;
    expect(top!.id).toBe('column-pedestal');
    // Margen dentro del dado: min(100, 100, 2·800) → A2 = 600², √(A2/A1) = 1.5.
    expect(top!.supportAreaMm2).toBeCloseTo(600 ** 2, 6);
    expect(top!.lowerStrengthKn).toBeCloseTo(0.65 * 0.85 * 25 * 160_000 * 1.5 / 1e3, 6);
    expect(bottom!.id).toBe('pedestal-footing');
    expect(bottom!.dowelMinimumMm2).toBeCloseTo(0.005 * 600 ** 2, 9);
    expect(result.checks.some((item) => item.id === 'pedestal-height')).toBe(false);
  });

  it('avisa del dado esbelto y rechaza uno menor que la columna', () => {
    expect(check(ok(designFooting({ ...base, pedestal: { ...pedestal, heightMm: 2000 } })), 'pedestal-height').status).toBe('warning');
    expect(designFooting({ ...base, pedestal: { ...pedestal, widthMm: 300 } }).ok).toBe(false);
  });
});
