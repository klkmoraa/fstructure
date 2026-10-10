import { describe, expect, it } from 'vitest';
import { designFlexureExercise, proposeFlexureDimensions, type FlexureExerciseInput } from './flexureExercise';

const base: FlexureExerciseInput = {
  code: 'ntc-2023', widthMm: 400, heightMm: 600, coverMm: 40, fcMpa: 25, fyMpa: 420,
  stirrupDiameterMm: 9.5, aggregateMm: 19, momentKnM: 200,
  top: { count: 2, diameterMm: 16 }, bottom: { count: 6, diameterMm: 16 },
};

describe('designFlexureExercise', () => {
  it('uses the independent rectangular equilibrium reference for a positive moment', () => {
    const result = designFlexureExercise(base);
    expect(result.requiredMm2).toBeCloseTo(1022.9561979432244, 1);
    expect(result.effectiveDepthMm).toBeCloseTo(542.5, 8);
    const aMm = result.requiredMm2 * base.fyMpa / (0.85 * base.fcMpa * base.widthMm);
    const referenceStrengthKnM = 0.9 * result.requiredMm2 * base.fyMpa * (result.effectiveDepthMm - aMm / 2) / 1e6;
    expect(referenceStrengthKnM).toBeCloseTo(200, 1);
    expect(result.providedMm2).toBeCloseTo(6 * Math.PI * 16 ** 2 / 4, 8);
    expect(result.checks.find((check) => check.id === 'bar-layout')?.status).toBe('pass');
  });

  it('uses top reinforcement as the tension bed for negative moment', () => {
    const positive = designFlexureExercise(base);
    const negative = designFlexureExercise({ ...base, momentKnM: -200 });
    expect(negative.layout.tensionBed).toBe('top');
    expect(negative.requiredMm2).toBeCloseTo(positive.requiredMm2, 8);
    expect(negative.providedMm2).not.toBe(positive.providedMm2);
    expect(negative.capacityKnM).not.toBe(positive.capacityKnM);
  });

  it('uses the area-weighted centroid for two layers and the extreme bar for strain', () => {
    const result = designFlexureExercise({ ...base, widthMm: 600, bottom: { count: 20, diameterMm: 16 } });
    expect(result.layout.bars?.some((bar) => bar.layer === 2)).toBe(true);
    const bars = result.layout.bars!;
    const area = (d: number) => Math.PI * d ** 2 / 4;
    const centroid = bars.reduce((sum, bar) => sum + area(bar.diameterMm) * bar.fromFaceMm, 0) / bars.reduce((sum, bar) => sum + area(bar.diameterMm), 0);
    expect(result.effectiveDepthMm).toBeCloseTo(base.heightMm - centroid, 8);
    expect(result.extremeDepthMm).toBeCloseTo(base.heightMm - Math.min(...bars.map((bar) => bar.fromFaceMm)), 8);
  });

  it('accepts an explicit zero moment and rejects invalid geometry or congested bars', () => {
    const zero = designFlexureExercise({ ...base, momentKnM: 0 });
    expect(zero.requiredMm2).toBe(0);
    expect(zero.status).not.toBe('pass');
    expect(designFlexureExercise({ ...base, widthMm: 80 }).checks.some((check) => check.status === 'fail')).toBe(true);
    expect(designFlexureExercise({ ...base, bottom: { count: 30, diameterMm: 32 } }).layout.bars).toBeNull();
  });

  it('rejects a tiny step before enumeration and returns no fit for invalid search inputs', () => {
    expect(proposeFlexureDimensions(base, { widthMinMm: 200, widthMaxMm: 600, heightMinMm: 250, heightMaxMm: 1500, stepMm: Number.MIN_VALUE })).toBeNull();
    expect(proposeFlexureDimensions({ ...base, momentKnM: Number.NaN }, { widthMinMm: 200, widthMaxMm: 600, heightMinMm: 250, heightMaxMm: 1500, stepMm: 50 })).toBeNull();
  });

  it('searches bounded section sizes using the supplied bars and returns no fit when bounds cannot work', () => {
    const bounds = { widthMinMm: 200, widthMaxMm: 600, heightMinMm: 250, heightMaxMm: 1500, stepMm: 50 };
    const proposed = proposeFlexureDimensions(base, bounds);
    expect(proposed).not.toBeNull();
    expect(proposed!.result.status).toBe('warning');
    expect(proposed!.result.checks.filter((check) => check.status !== 'out-of-scope').every((check) => check.status === 'pass')).toBe(true);
    expect(proposed!.widthMm).toBeGreaterThanOrEqual(200);
    expect(proposed!.heightMm).toBeGreaterThanOrEqual(250);
    expect(proposeFlexureDimensions({ ...base, momentKnM: 1e6 }, { ...bounds, widthMaxMm: 200, heightMaxMm: 250 })).toBeNull();
  });
});

describe('independent two-layer reference', () => {
  it('uses the actual area centroid d=528.9167 mm while strain uses dt=542.55 mm', () => {
    const result = designFlexureExercise({ ...base, widthMm: 250, heightMm: 600, bottom: { count: 6, diameterMm: 15.9 } });
    expect(result.layout.bars?.filter((bar) => bar.layer === 1)).toHaveLength(4);
    expect(result.layout.bars?.filter((bar) => bar.layer === 2)).toHaveLength(2);
    expect(result.effectiveDepthMm).toBeCloseTo(528.9166666667, 6);
    expect(result.extremeDepthMm).toBeCloseTo(542.55, 6);
    expect(result.requiredMm2).toBeCloseTo(1088.97524658769, 1);
  });
});
