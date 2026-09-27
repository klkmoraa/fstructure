import { describe, expect, it } from 'vitest';
import { designBeam, type BeamDesignInput } from './beam';
import { designCode } from './codes';
import { barArea, equivalentBlockStrengthMpa } from './shared';

const base: BeamDesignInput = {
  code: 'ntc-2023', widthMm: 250, heightMm: 500, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420,
  spans: [{ lengthM: 6, deadKnPerM: 15, liveKnPerM: 10, pointDeadKn: 0, pointLiveKn: 0, pointAtM: 3 }],
  leftEnd: 'pin', rightEnd: 'pin', includeSelfWeight: true, combinations: designCode('ntc-2023').loadCombinations('B'),
  sustainedLiveRatio: 0.4, longTermXi: 2, barDiameterMm: null, stirrupDiameterMm: 9.5, maxAggregateMm: 19,
  damagesNonstructural: false, supportWidthMm: 400,
  provided: { top: { count: 2, diameterMm: 15.9 }, bottom: { count: 3, diameterMm: 25.4 }, bastions: 'none', stirrupSpacingMm: null },
};

const ok = (result: ReturnType<typeof designBeam>) => {
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};
const midspanCapacity = (result: ReturnType<typeof ok>) => Math.max(...result.diagram.capacityPositiveKnm);

describe('viga T y L', () => {
  const fpp = equivalentBlockStrengthMpa(25);
  const tension = 3 * barArea(25.4) * 420;

  it('con el bloque dentro del patín resiste como rectangular de ancho bf', () => {
    const result = ok(designBeam({ ...base, flange: { kind: 'T', widthMm: 1000, thicknessMm: 100 } }));
    const d = result.continuousBottom.effectiveDepthMm;
    const a = tension / (fpp * 1000);
    expect(a).toBeLessThan(100);
    expect(midspanCapacity(result)).toBeCloseTo(0.9 * tension * (d - a / 2) / 1e6, 6);
  });

  it('con el bloque en el alma suma el vuelo del patín y el alma', () => {
    const flange = { kind: 'L' as const, widthMm: 400, thicknessMm: 50 };
    const result = ok(designBeam({ ...base, flange }));
    const d = result.continuousBottom.effectiveDepthMm;
    const overhang = fpp * (400 - 250) * 50;
    const a = (tension - overhang) / (fpp * 250);
    expect(a).toBeGreaterThan(50);
    const nominal = overhang * (d - 25) + (tension - overhang) * (d - a / 2);
    expect(midspanCapacity(result) / result.continuousBottom.resistanceFactor).toBeCloseTo(nominal / 1e6, 6);
  });

  it('resiste más a momento positivo que la rectangular del alma y no cambia el negativo', () => {
    const rectangular = ok(designBeam({ ...base, spans: [base.spans[0]!, base.spans[0]!] }));
    const tee = ok(designBeam({ ...base, spans: [base.spans[0]!, base.spans[0]!], flange: { kind: 'T', widthMm: 1200, thicknessMm: 120 } }));
    expect(midspanCapacity(tee)).toBeGreaterThan(midspanCapacity(rectangular));
    expect(Math.min(...tee.diagram.capacityNegativeKnm)).toBeCloseTo(Math.min(...rectangular.diagram.capacityNegativeKnm), 6);
  });

  it('toma el peso propio del alma bajo la losa', () => {
    const result = ok(designBeam({ ...base, flange: { kind: 'T', widthMm: 1000, thicknessMm: 100 } }));
    expect(result.selfWeightKnPerM).toBeCloseTo(24 * 0.25 * 0.4, 9);
  });

  it('resuelve con el patín un momento que la rectangular del alma no alcanza', () => {
    const auto = { ...base, provided: null, spans: [{ ...base.spans[0]!, lengthM: 7, deadKnPerM: 25, liveKnPerM: 15 }] };
    const flexure = (result: ReturnType<typeof ok>) => result.checks.find((check) => check.id === 'flexure-positive')!.status;
    expect(flexure(ok(designBeam(auto)))).toBe('fail');
    expect(flexure(ok(designBeam({ ...auto, flange: { kind: 'T', widthMm: 1200, thicknessMm: 120 } })))).toBe('pass');
  });

  it('rechaza un patín más angosto que el alma o más grueso que la viga', () => {
    expect(designBeam({ ...base, flange: { kind: 'T', widthMm: 200, thicknessMm: 100 } }).ok).toBe(false);
    expect(designBeam({ ...base, flange: { kind: 'T', widthMm: 1000, thicknessMm: 500 } }).ok).toBe(false);
  });
});
