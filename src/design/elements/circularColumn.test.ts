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

  it('pide seis barras dentro de estribo circular con la NTC', () => {
    const five = ok(designColumn({ ...base, barCount: 5 }));
    expect(five.checks.find((check) => check.id === 'min-bars')!.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'min-bars')!.status).toBe('pass');
    const nsr = ok(designColumn({ ...base, code: 'nsr-10', barCount: 5 }));
    expect(nsr.checks.some((check) => check.id === 'min-bars')).toBe(false);
  });
});

describe('columna zunchada (NTC 14.7.4)', () => {
  const spiral = ok(designColumn({ ...base, transverse: 'spiral' }));
  const result = ok(designColumn(base));

  it('diseña el paso por cuantía volumétrica y paso libre', () => {
    const core = 500 - 2 * 40;
    const required = 0.45 * (Math.PI * 250 ** 2 / (Math.PI * core ** 2 / 4) - 1) * 28 / 420;
    const volume = 4 * barArea(9.5) * (core - 9.5) / core ** 2;
    const design = spiral.ties.spiral!;
    expect(design.requiredRatio).toBeCloseTo(required, 9);
    expect(design.ratioPitchMm).toBeCloseTo(volume / required, 9);
    expect(design.pitchMm).toBe(50);
    expect(design.clearPitchMm).toBeCloseTo(40.5, 9);
    expect(design.minimumClearPitchMm).toBeCloseTo(28.5, 9);
    for (const id of ['spiral-ratio', 'spiral-pitch-max', 'spiral-pitch-min']) {
      expect(spiral.checks.find((check) => check.id === id)!.status).toBe('pass');
    }
    expect(spiral.checks.some((check) => check.id.startsWith('tie-end') || check.id === 'tie-center-spacing')).toBe(false);
  });

  it('usa FR = 0.75 en compresión y 0.90 en tensión controlada', () => {
    expect(spiral.maximumDesignAxialKn).toBeCloseTo(0.75 * spiral.squashLoadKn, 6);
    expect(result.maximumDesignAxialKn).toBeCloseTo(0.65 * result.squashLoadKn, 6);
    const yieldStrain = 420 / 200_000;
    for (const point of spiral.aboutX.nominal.slice(1, -1)) {
      expect(point.phi).toBeGreaterThanOrEqual(0.75 - 1e-12);
      expect(point.phi).toBeLessThanOrEqual(0.9 + 1e-12);
    }
    expect(spiral.aboutX.nominal.at(-1)!.phi).toBe(0.75);
    expect(spiral.aboutX.nominal[0]!.phi).toBe(0.9);
    // Transición lineal: 0.75 + 0.15 (εt − εty)/0.003.
    const transition = 0.75 + 0.15 * (yieldStrain + 0.0015 - yieldStrain) / 0.003;
    expect(transition).toBeCloseTo(0.825, 12);
    expect(spiral.capacity.ratio).toBeLessThan(result.capacity.ratio);
  });

  it('cierra el paso si el cortante lo pide y reprueba un zuncho que no cabe', () => {
    const sheared = ok(designColumn({ ...base, transverse: 'spiral', shearXKn: 780 }));
    expect(sheared.ties.spiral!.pitchMm).toBeLessThan(50);
    const tight = ok(designColumn({ ...base, transverse: 'spiral', fcMpa: 60 }));
    expect(tight.checks.find((check) => check.id === 'spiral-pitch-min')!.status).toBe('fail');
  });

  it('sólo existe con la NTC y en columnas circulares', () => {
    expect(designColumn({ ...base, code: 'nsr-10', transverse: 'spiral' }).ok).toBe(false);
    expect(designColumn({ ...base, shape: 'rectangular', transverse: 'spiral' }).ok).toBe(false);
  });
});
