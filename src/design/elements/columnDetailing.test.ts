import { describe, expect, it } from 'vitest';
import { designColumn, type ColumnDesignInput } from './column';
import { barArea, rebarLabel } from './shared';
import { columnTakeoff, takeoffBarUsage } from './takeoff';

const base: ColumnDesignInput = {
  code: 'ntc-2023', widthMm: 400, depthMm: 400, coverMm: 40, fcMpa: 28, fyMpa: 420,
  barDiameterMm: 25.4, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5, maxAggregateMm: 19,
  axialKn: 1000, momentXKnm: 100, momentYKnm: 0, shearXKn: 0, shearYKn: 0,
  unbracedLengthM: 3, effectiveLengthFactor: 1, curvature: 'single', endMomentRatio: 1, sustainedRatio: 0.6,
  braced: true, swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0, group: 'B2', groundFloor: false,
};
const ok = (input: ColumnDesignInput) => {
  const result = designColumn(input);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
};

describe('separación de refuerzo transversal elegida por la persona', () => {
  it('etiqueta #2 en cuantificación de estribos y grapas, nunca como longitudinal', () => {
    const result = ok({ ...base, tieDiameterMm: 6.4 });
    const takeoff = columnTakeoff(result);
    const transverse = takeoff.lines.filter((line) => /Estribos|Grapas/.test(line.mark));
    expect(transverse).toHaveLength(3);
    expect(transverse.every((line) => line.mark.includes('#2'))).toBe(true);
    expect(takeoff.lines.filter((line) => /Longitudinales/.test(line.mark)).every((line) => !line.mark.includes('#2'))).toBe(true);
    expect(transverse.every((line) => rebarLabel(line.diameterMm, takeoffBarUsage(line.mark)) === '#2')).toBe(true);
    expect(takeoffBarUsage(transverse.find((line) => /Grapas/.test(line.mark))!.mark)).toBe('transverse');
  });

  it('conserva la propuesta, evalúa la separación exacta y modifica las cantidades', () => {
    const proposed = ok(base);
    const chosen = ok({ ...base, tieSpacingMm: 123, endTieSpacingMm: 75 });
    expect(chosen.ties.centerSpacingMm).toBe(123);
    expect(chosen.ties.endSpacingMm).toBe(75);
    expect(chosen.ties.proposedCenterSpacingMm).toBe(proposed.ties.centerSpacingMm);
    expect(chosen.ties.proposedEndSpacingMm).toBe(proposed.ties.endSpacingMm);
    const takeoff = columnTakeoff(chosen);
    const hoops = takeoff.lines.find((line) => line.mark.startsWith('Estribos'))!;
    expect(hoops.count).toBe(2 * Math.ceil(600 / 75) + Math.ceil(1800 / 123) + 1);
    expect(takeoff.steelKg).toBeGreaterThan(columnTakeoff(proposed).steelKg);
    expect(takeoff.concreteM3).toBeCloseTo(0.48, 9);
  });

  it('recalcula φVc + φAvfyd/s y reprueba cortante al abrir los estribos', () => {
    const result = ok({ ...base, shearXKn: 300, tieSpacingMm: 600 });
    const d = 400 - 40 - 9.5 - 25.4 / 2;
    const concrete = 0.75 * Math.min(0.42 * Math.sqrt(28), 0.17 * Math.sqrt(28) + Math.min(1000e3 / (6 * 160000), 0.05 * 28)) * 400 * d / 1e3;
    const steel = 0.75 * 3 * barArea(9.5) * 420 * d / 600 / 1e3;
    expect(result.ties.shear.x.strengthKn).toBeCloseTo(concrete + steel, 9);
    expect(result.checks.find((check) => check.id === 'shear-x')?.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'tie-center-spacing')?.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'tie-shear-spacing-x')?.status).toBe('fail');
    expect(result.status).toBe('fail');
  });

  it('usa la separación más abierta entre extremos y centro para el cortante', () => {
    const result = ok({ ...base, shearXKn: 300, tieSpacingMm: 75, endTieSpacingMm: 600 });
    expect(result.ties.governingSpacingMm).toBe(600);
    expect(result.checks.find((check) => check.id === 'tie-end-spacing')?.status).toBe('fail');
    expect(result.checks.find((check) => check.id === 'shear-x')?.status).toBe('fail');
  });

  it.each([0, -50, Number.NaN, Number.POSITIVE_INFINITY])('rechaza separación inválida %s', (spacing) => {
    expect(designColumn({ ...base, tieSpacingMm: spacing }).ok).toBe(false);
    expect(designColumn({ ...base, endTieSpacingMm: spacing }).ok).toBe(false);
  });

  it('evalúa un paso helicoidal propio por cuantía y límites libres', () => {
    const spiral: ColumnDesignInput = { ...base, shape: 'circular', widthMm: 500, depthMm: 500, barCount: 8, transverse: 'spiral' };
    const proposed = ok(spiral);
    const chosen = ok({ ...spiral, tieSpacingMm: 150 });
    expect(chosen.ties.spiral?.pitchMm).toBe(150);
    expect(chosen.ties.proposedCenterSpacingMm).toBe(proposed.ties.centerSpacingMm);
    expect(chosen.checks.find((check) => check.id === 'spiral-ratio')?.status).toBe('fail');
    expect(chosen.checks.find((check) => check.id === 'spiral-pitch-max')?.status).toBe('fail');
    expect(designColumn({ ...spiral, endTieSpacingMm: 75 }).ok).toBe(false);
  });
});

describe('restricción propia en la dirección Y (marco espacial)', () => {
  const sway: ColumnDesignInput = {
    ...base, code: 'nsr-10', braced: false, effectiveLengthFactor: 1.2, stabilityIndex: 0.05, unbracedLengthM: 4,
    momentXKnm: 60, momentYKnm: 40, swayMomentXKnm: 30, swayMomentYKnm: 30,
  };
  it('con los mismos valores que X, Y da el mismo resultado que sin ella', () => {
    const plain = ok(sway);
    const same = ok({ ...sway, alongY: { effectiveLengthFactor: 1.2, stabilityIndex: 0.05, curvature: 'single', endMomentRatio: 1 } });
    expect(same.magnification.y.designMomentKnm).toBeCloseTo(plain.magnification.y.designMomentKnm, 9);
    expect(same.governingRatio).toBeCloseTo(plain.governingRatio, 9);
  });
  it('un índice de estabilidad mayor en Y amplifica sólo el momento de esa dirección (δs = 1/(1 − Q))', () => {
    const plain = ok(sway);
    const loose = ok({ ...sway, alongY: { effectiveLengthFactor: 2, stabilityIndex: 0.2, curvature: 'double', endMomentRatio: 0.5 } });
    expect(loose.magnification.x.designMomentKnm).toBeCloseTo(plain.magnification.x.designMomentKnm, 9);
    expect(loose.magnification.y.swayFactor).toBeCloseTo(1 / (1 - 0.2), 9);
    expect(loose.magnification.y.designMomentKnm).toBeGreaterThan(plain.magnification.y.designMomentKnm);
    expect(loose.governingRatio).toBeGreaterThan(plain.governingRatio);
  });
  it('rechaza una k menor que 1 en Y si el marco se desplaza', () => {
    const result = designColumn({ ...sway, alongY: { effectiveLengthFactor: 0.8, stabilityIndex: 0, curvature: 'single', endMomentRatio: 1 } });
    expect(result.ok).toBe(false);
  });
});
