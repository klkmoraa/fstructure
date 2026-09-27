import { describe, expect, it } from 'vitest';
import { designColumn, momentCapacityAt, type ColumnDesignInput } from './column';
import { barArea, betaOne, equivalentBlockStrengthMpa } from './shared';

const base: ColumnDesignInput = {
  code: 'ntc-2023', shape: 'circular', widthMm: 500, depthMm: 500, barCount: 8, coverMm: 40, fcMpa: 28, fyMpa: 420,
  barDiameterMm: 25.4, barsAlongWidth: 2, barsAlongDepth: 2, tieDiameterMm: 9.5, maxAggregateMm: 19,
  axialKn: 1500, momentXKnm: 120, momentYKnm: 0, shearXKn: 0, shearYKn: 0, unbracedLengthM: 3, effectiveLengthFactor: 1,
  curvature: 'single', endMomentRatio: 1, sustainedRatio: 0.6, group: 'B2', groundFloor: false, braced: true,
  swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0,
};

const ok = (result: ReturnType<typeof designColumn>) => {
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};

/**
 * Oráculo: la misma sección integrada por fibras (malla de 1 mm) con las
 * hipótesis de 3.6.1, sin fórmulas de segmento circular. Devuelve (P, M) nominales
 * para una profundidad de eje neutro c.
 */
function fiberSection(c: number, bars: readonly { y: number }[]) {
  const { widthMm: D, fcMpa: fc, fyMpa: fy, barDiameterMm: db } = base;
  const R = D / 2;
  const a = betaOne(fc) * c;
  const fpp = equivalentBlockStrengthMpa(fc);
  let axial = 0;
  let moment = 0;
  const step = 1;
  for (let y = -R + step / 2; y < R; y += step) {
    if (R - y > a) continue;
    const width = 2 * Math.sqrt(R ** 2 - y ** 2);
    axial += fpp * width * step;
    moment += fpp * width * step * y;
  }
  for (const bar of bars) {
    const strain = 0.003 * (c - (R - bar.y)) / c;
    let stress = Math.max(-fy, Math.min(fy, strain * 200_000));
    if (R - bar.y < a) stress -= fpp;
    axial += stress * barArea(db);
    moment += stress * barArea(db) * bar.y;
  }
  return { axialKn: axial / 1e3, momentKnm: moment / 1e6 };
}

describe('columna circular', () => {
  const result = ok(designColumn(base));

  it('reparte las barras en la circunferencia y usa el área del círculo', () => {
    expect(result.bars).toHaveLength(8);
    const radius = 250 - 40 - 9.5 - 12.7;
    for (const bar of result.bars) expect(Math.hypot(bar.x, bar.y)).toBeCloseTo(radius, 6);
    expect(result.grossAreaMm2).toBeCloseTo(Math.PI * 250 ** 2, 6);
    const steel = 8 * barArea(25.4);
    expect(result.squashLoadKn).toBeCloseTo((0.85 * 28 * (Math.PI * 250 ** 2 - steel) + 420 * steel) / 1e3, 6);
  });

  it('sus dos orientaciones coinciden con una integración por fibras', () => {
    const radius = 250 - 40 - 9.5 - 12.7;
    const arrangement = (rotation: number) => Array.from({ length: 8 }, (_, index) => ({ y: radius * Math.sin(Math.PI / 2 + rotation + 2 * Math.PI * index / 8) }));
    const oracleMoment = (axialKn: number, bars: readonly { y: number }[]) => {
      // Busca la c del oráculo que da la misma carga axial.
      let low = 1;
      let high = 5000;
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (low + high) / 2;
        if (fiberSection(middle, bars).axialKn < axialKn) low = middle; else high = middle;
      }
      return fiberSection((low + high) / 2, bars).momentKnm;
    };
    const orientations = [arrangement(0), arrangement(Math.PI / 8)];
    for (const curve of [result.aboutX, result.aboutY]) {
      const points = curve.nominal.filter((point) => point.axialKn > 0 && point.momentKnm > 20).slice(0, 40);
      const matches = orientations.map((bars) => points.every((point) => Math.abs(oracleMoment(point.axialKn, bars) - point.momentKnm) < 0.01 * point.momentKnm + 0.5));
      expect(matches.some(Boolean)).toBe(true);
    }
  });

  it('flexiona con el momento resultante y revisa cortante resultante', () => {
    const biaxial = ok(designColumn({ ...base, momentXKnm: 90, momentYKnm: 120, shearXKn: 60, shearYKn: 80 }));
    const uniaxial = ok(designColumn({ ...base, momentXKnm: 150, momentYKnm: 0, shearXKn: 100 }));
    expect(biaxial.capacity.method).toBe('resultant');
    expect(biaxial.capacity.ratio).toBeCloseTo(uniaxial.capacity.ratio, 9);
    const shear = biaxial.checks.find((check) => check.id === 'shear-x')!;
    expect(shear.demand).toBeCloseTo(100, 9);
    expect(biaxial.checks.some((check) => check.id === 'shear-y')).toBe(false);
    expect(biaxial.checks.some((check) => check.id === 'hx' || check.id === 'aspect')).toBe(false);
  });

  it('toma r = D/4 para la esbeltez', () => {
    const slender = ok(designColumn({ ...base, unbracedLengthM: 6 }));
    expect(slender.slenderness.x).toBeCloseTo(6000 / 125, 9);
  });

  it('rige la orientación del arreglo con menor resistencia', () => {
    const rotatedCapacity = momentCapacityAt(result.aboutY.design, 1500);
    const firstCapacity = momentCapacityAt(result.aboutX.design, 1500);
    const governing = Math.min(rotatedCapacity, firstCapacity);
    expect(result.capacity.ratio).toBeGreaterThanOrEqual(result.magnification.x.designMomentKnm / Math.max(rotatedCapacity, firstCapacity) - 1e-6);
    expect(governing).toBeGreaterThan(0);
  });

  it('pide un número de barras válido', () => {
    expect(designColumn({ ...base, barCount: 3 }).ok).toBe(false);
    expect(designColumn({ ...base, barCount: undefined }).ok).toBe(false);
  });
});
