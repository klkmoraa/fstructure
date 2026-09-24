import { describe, expect, it } from 'vitest';
import { designBeam, type BeamDesignInput } from './beam';
import { designCode, type LoadCombination } from './codes';
import { columnBars, designColumn, momentCapacityAt, rayCapacity, type ColumnDesignInput } from './column';
import { designFooting, sizeFactor, type FootingDesignInput } from './footing';
import { flexuralCapacity, requiredFlexuralSteelMm2 } from './shared';

const developmentLength = designCode('ntc-2023').developmentLength;
/** NTC Grupo B: 1.3 CM + 1.5 CV; `favorableDead` = 1.3 salvo que la prueba lo cambie. */
const ntcB = (favorableDead = 1.3): LoadCombination[] => [{ label: 'NTC B', dead: 1.3, favorableDead, live: 1.5 }];

const span = (lengthM: number, deadKnPerM = 20, liveKnPerM = 10) => ({ lengthM, deadKnPerM, liveKnPerM, pointDeadKn: 0, pointLiveKn: 0, pointAtM: lengthM / 2 });
const beam: BeamDesignInput = {
  code: 'ntc-2023', widthMm: 300, heightMm: 600, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420,
  spans: [span(6)], leftEnd: 'pin', rightEnd: 'pin', includeSelfWeight: false,
  combinations: ntcB(), sustainedLiveRatio: 0, longTermXi: 2,
  barDiameterMm: null, stirrupDiameterMm: null, maxAggregateMm: 19, damagesNonstructural: false, supportWidthMm: 400,
};
const wu = 1.3 * 20 + 1.5 * 10;

const assertBeam = (input: BeamDesignInput) => {
  const result = designBeam(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result;
};

describe('designBeam (análisis con el solver 2D)', () => {
  it('reproduces classic moments and shears for each support condition', () => {
    const simple = assertBeam(beam);
    expect(simple.extremes.positiveMomentKnm).toBeCloseTo(wu * 36 / 8, 6);
    expect(simple.extremes.negativeMomentKnm).toBeCloseTo(0, 6);
    expect(simple.extremes.shearKn).toBeCloseTo(wu * 3, 6);

    const fixed = assertBeam({ ...beam, leftEnd: 'fixed', rightEnd: 'fixed' });
    expect(fixed.extremes.negativeMomentKnm).toBeCloseTo(wu * 36 / 12, 6);
    expect(fixed.extremes.positiveMomentKnm).toBeCloseTo(wu * 36 / 24, 6);

    const cantilever = assertBeam({ ...beam, spans: [span(2)], leftEnd: 'fixed', rightEnd: 'free' });
    expect(cantilever.extremes.negativeMomentKnm).toBeCloseTo(wu * 4 / 2, 6);
    expect(cantilever.extremes.shearKn).toBeCloseTo(wu * 2, 6);
    expect(cantilever.spans[0]!.cantilever).toBe(true);

    const propped = assertBeam({ ...beam, leftEnd: 'fixed', rightEnd: 'pin' });
    expect(propped.extremes.negativeMomentKnm).toBeCloseTo(wu * 36 / 8, 6);
    expect(propped.extremes.positiveMomentKnm).toBeCloseTo(9 * wu * 36 / 128, 6);
  });

  it('envelopes live-load patterns on a two-span continuous beam', () => {
    // Sólo carga viva: M⁻ en el apoyo central con ambos claros cargados (wL²/8);
    // M⁺ máximo con un solo claro cargado (49wL²/512).
    const result = assertBeam({ ...beam, spans: [span(6, 0, 10), span(6, 0, 10)] });
    expect(result.solverRuns).toBe(8);
    expect(result.extremes.negativeMomentKnm).toBeCloseTo(1.5 * 10 * 36 / 8, 6);
    expect(result.extremes.positiveMomentKnm).toBeCloseTo(1.5 * 49 * 10 * 36 / 512, 6);
    expect(result.spans).toHaveLength(2);
    expect(result.spans[0]!.negativeRightKnm).toBeCloseTo(1.5 * 10 * 36 / 8, 6);
  });

  it('places point loads anywhere along the span', () => {
    // P = 130 kN a 2 m de un claro simple de 6 m: M = Pab/L y V = Pb/L.
    const result = assertBeam({ ...beam, spans: [{ ...span(6, 0, 0), pointDeadKn: 100, pointAtM: 2 }] });
    expect(result.extremes.positiveMomentKnm).toBeCloseTo(130 * 2 * 4 / 6, 6);
    expect(Math.max(...result.diagram.shearMaxKn)).toBeCloseTo(130 * 4 / 6, 6);
    expect(Math.min(...result.diagram.shearMinKn)).toBeCloseTo(-130 * 2 / 6, 6);
    expect(result.diagram.xM[result.diagram.momentMaxKnm.indexOf(Math.max(...result.diagram.momentMaxKnm))]).toBeCloseTo(2, 9);
    expect(designBeam({ ...beam, spans: [{ ...span(6, 0, 0), pointDeadKn: 100, pointAtM: 7 }] }).ok).toBe(false);
  });

  it('adds bastones where the envelope exceeds the continuous bars and extends them by ld', () => {
    const result = assertBeam({ ...beam, spans: [span(6, 30, 20), span(6, 30, 20)] });
    const top = result.bastions.filter((bastion) => bastion.bed === 'top');
    expect(top).toHaveLength(1);
    const [support] = top;
    expect(support!.startM).toBeLessThan(6);
    expect(support!.endM).toBeGreaterThan(6);
    expect(6 - support!.startM).toBeGreaterThanOrEqual(support!.developmentLengthMm / 1e3 - 1e-9);
    expect(support!.endM - 6).toBeGreaterThanOrEqual(support!.developmentLengthMm / 1e3 - 1e-9);
    expect(result.continuousTop.continuous.count).toBe(2);
    expect(result.continuousBottom.continuous.count).toBe(2);
    // La capacidad provista cubre la envolvente en toda la viga.
    result.diagram.xM.forEach((_, index) => {
      expect(result.diagram.capacityPositiveKnm[index]! + 1e-6).toBeGreaterThanOrEqual(result.diagram.momentMaxKnm[index]!);
      expect(result.diagram.capacityNegativeKnm[index]! - 1e-6).toBeLessThanOrEqual(result.diagram.momentMinKnm[index]!);
    });
    expect(result.checks.find((check) => check.id === 'flexure-negative')!.status).toBe('pass');
  });

  it('designs stirrups span by span', () => {
    const result = assertBeam({ ...beam, spans: [span(6, 30, 20), span(3, 5, 2)] });
    result.spans.forEach((item) => expect(item.stirrups.strengthKn).toBeGreaterThanOrEqual(item.stirrups.demandKn));
    expect(result.spans[0]!.stirrups.demandKn).toBeGreaterThan(result.spans[1]!.stirrups.demandKn);
  });

  it('matches 5wL⁴/384EI while the section stays uncracked', () => {
    const light = assertBeam({ ...beam, spans: [span(6, 1, 0)] });
    expect(light.spans[0]!.effectiveInertiaRatio).toBe(1);
    const ec = 4_400 * Math.sqrt(25);
    const inertia = 300 * 600 ** 3 / 12;
    expect(light.spans[0]!.immediateMm).toBeCloseTo(5 * 1 * 6_000 ** 4 / (384 * ec * inertia), 4);
  });

  it('reanalyzes deflections with the cracked inertia of each span', () => {
    const result = assertBeam({ ...beam, spans: [span(6, 30, 20), span(3, 30, 20)] });
    const long = result.spans[0]!;
    expect(long.effectiveInertiaRatio).toBeLessThan(1);
    expect(long.effectiveInertiaRatio).toBeGreaterThan(0.1);
    expect(long.deflectionMm).toBeGreaterThan(long.immediateMm);
  });

  it('includes self weight when requested', () => {
    const result = assertBeam({ ...beam, includeSelfWeight: true });
    expect(result.selfWeightKnPerM).toBeCloseTo(24 * 0.3 * 0.6, 9);
    expect(result.extremes.positiveMomentKnm).toBeCloseTo((wu + 1.3 * 24 * 0.18) * 36 / 8, 6);
  });

  it('passes the example and fails visibly when the section is too small', () => {
    expect(assertBeam(beam).status).toBe('pass');
    expect(assertBeam({ ...beam, widthMm: 200, heightMm: 300, spans: [span(6, 20, 200)] }).status).toBe('fail');
  });

  it('rejects invalid input and unstable supports instead of computing', () => {
    expect(designBeam({ ...beam, spans: [span(Number.NaN)] }).ok).toBe(false);
    expect(designBeam({ ...beam, leftEnd: 'free', rightEnd: 'free' }).ok).toBe(false);
    expect(designBeam({ ...beam, leftEnd: 'pin', rightEnd: 'free' }).ok).toBe(false);
  });
});

const column: ColumnDesignInput = {
  code: 'ntc-2023', widthMm: 400, depthMm: 400, coverMm: 40, fcMpa: 28, fyMpa: 420, barDiameterMm: 25.4,
  barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5, maxAggregateMm: 19, axialKn: 1_000, momentXKnm: 100, momentYKnm: 0,
  shearXKn: 0, shearYKn: 0, unbracedLengthM: 2.4, effectiveLengthFactor: 1, curvature: 'single', endMomentRatio: 1, sustainedRatio: 0.6,
  braced: true, swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0,
  group: 'B2', groundFloor: false,
};

const assertColumn = (input: ColumnDesignInput) => {
  const result = designColumn(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result;
};

describe('designColumn', () => {
  it('places the perimeter bars without duplicates', () => {
    expect(columnBars(column)).toHaveLength(8);
    expect(columnBars({ ...column, barsAlongWidth: 4, barsAlongDepth: 2 })).toHaveLength(8);
  });

  it('computes the squash load and the design cap', () => {
    const result = assertColumn(column);
    const as = 8 * Math.PI * 25.4 ** 2 / 4;
    const p0 = (0.85 * 28 * (160_000 - as) + 420 * as) / 1e3;
    expect(result.squashLoadKn).toBeCloseTo(p0, 6);
    // NTC 2023 no aplica el tope 0.8 de ACI: PR0 = FR·P0 y la excentricidad mínima de 5.3.2.1 toma su lugar.
    expect(result.maximumDesignAxialKn).toBeCloseTo(0.65 * p0, 6);
    expect(result.aboutX.nominal[0]!.axialKn).toBeCloseTo(-420 * as / 1e3, 6);
  });

  it('matches a hand-computed strain-compatibility point (c = 200 mm)', () => {
    const result = assertColumn(column);
    // Cc = 0.85·28·170·400; barras a ±137.8 mm con ε = ±0.002067 → 413.4 MPa.
    const moment = momentCapacityAt(result.aboutX.nominal, 1_582.18);
    expect(moment).toBeGreaterThan(354.3 * 0.985);
    expect(moment).toBeLessThan(354.3 * 1.015);
  });

  it('is symmetric for a square symmetric section', () => {
    const result = assertColumn(column);
    expect(momentCapacityAt(result.aboutX.design, 800)).toBeCloseTo(momentCapacityAt(result.aboutY.design, 800), 6);
  });

  it('finds the capacity along the load ray', () => {
    const result = assertColumn(column);
    const hit = rayCapacity(result.aboutX.design, 100, 1_000)!;
    expect(hit.axialKn / hit.momentKnm).toBeCloseTo(10, 6);
    expect(result.capacity.ratio).toBeCloseTo(1_000 / hit.axialKn, 6);
    expect(result.capacity.method).toBe('uniaxial-x');
  });

  it('uses Bresler for biaxial bending with significant axial load', () => {
    const uniaxial = assertColumn(column);
    const biaxial = assertColumn({ ...column, momentYKnm: 100 });
    expect(biaxial.capacity.method).toBe('bresler-load');
    expect(biaxial.capacity.ratio).toBeGreaterThan(uniaxial.capacity.ratio);
  });

  it('does not magnify a short column', () => {
    const result = assertColumn(column);
    expect(result.magnification.x.slender).toBe(false);
    expect(result.magnification.x.designMomentKnm).toBe(100);
  });

  it('magnifies moments of a slender braced column by hand', () => {
    const result = assertColumn({ ...column, unbracedLengthM: 5 });
    // H/r = 5000/(400/√12) = 43.3 > 22; EI = 0.4·Ec·Ig/1.6; Pc = π²EI/(kLu)²; δ = 1/(1 − Pu/0.75Pc).
    const ec = 4_400 * Math.sqrt(28);
    const pc = Math.PI ** 2 * (0.4 * ec * 400 ** 4 / 12 / 1.6) / 5_000 ** 2 / 1e3;
    const delta = 1 / (1 - 1_000 / (0.75 * pc));
    expect(result.magnification.x.slender).toBe(true);
    expect(result.magnification.x.criticalLoadKn).toBeCloseTo(pc, 6);
    expect(result.magnification.x.factor).toBeCloseTo(delta, 9);
    expect(result.magnification.x.designMomentKnm).toBeCloseTo(delta * 100, 6);
    expect(result.capacity.ratio).toBeGreaterThan(assertColumn(column).capacity.ratio);
  });

  it('applies the NTC minimum eccentricity with Cm = 1 and the unrestricted double-curvature limit', () => {
    const tiny = assertColumn({ ...column, momentXKnm: 1, unbracedLengthM: 5 });
    expect(tiny.magnification.x.minimumEccentricityMm).toBe(20);
    expect(tiny.magnification.x.minimumMomentKnm).toBeCloseTo(1_000 * 20 / 1e3, 9);
    expect(tiny.magnification.x.cm).toBe(1);
    const ec = 4_400 * Math.sqrt(28);
    const pc = Math.PI ** 2 * (0.4 * ec * 400 ** 4 / 12 / 1.6) / 5_000 ** 2 / 1e3;
    expect(tiny.magnification.x.designMomentKnm).toBeCloseTo(20 / (1 - 1_000 / (0.75 * pc)), 6);
    const double = assertColumn({ ...column, curvature: 'double', unbracedLengthM: 5 });
    expect(double.magnification.x.limit).toBe(46);
    // NTC: r es el radio de giro de la sección bruta, h/√12 (no la aproximación 0.3h de ACI).
    expect(double.magnification.x.slenderness).toBeCloseTo(5_000 / (400 / Math.sqrt(12)), 9);
    expect(double.magnification.x.slender).toBe(false);
  });

  it('checks pure axial load with the minimum eccentricity in both directions', () => {
    const result = assertColumn({ ...column, momentXKnm: 0, momentYKnm: 0 });
    expect(result.capacity.ratio).toBeGreaterThan(1_000 / result.maximumDesignAxialKn);
    expect(result.capacity.detail).toMatch(/Momento mínimo/);
  });

  it('enforces the NTC column limits: 6 % steel, minimum dimension by group and aspect ratio', () => {
    const small = assertColumn({ ...column, widthMm: 250, depthMm: 250, barDiameterMm: 15.9, axialKn: 300, momentXKnm: 10, momentYKnm: 0 });
    expect(small.checks.find((check) => check.id === 'min-dimension')!.status).toBe('pass');
    expect(assertColumn({ ...small.input, group: 'A' }).checks.find((check) => check.id === 'min-dimension')!.status).toBe('fail');
    expect(assertColumn({ ...column, depthMm: 1_700, barsAlongDepth: 6 }).checks.find((check) => check.id === 'aspect')!.status).toBe('fail');
    expect(assertColumn({ ...column, barDiameterMm: 25.4, barsAlongWidth: 5, barsAlongDepth: 5 }).checks.find((check) => check.id === 'ratio-max')!.status).toBe('pass');
  });

  it('details ties per NTC 2023: so, Lo, 16db and 48 tie diameters', () => {
    const result = assertColumn({ ...column, barDiameterMm: 19.1, unbracedLengthM: 3 });
    // so ≤ min(8·19.1, 200, 400/4) = 100 mm; Lo ≥ max(3000/6, 400, 600) = 600 mm.
    expect(result.ties.endSpacingMm).toBe(100);
    expect(result.ties.endLengthMm).toBe(600);
    expect(result.ties.centerSpacingMm).toBeLessThanOrEqual(Math.min(16 * 19.1, 48 * 9.5));
    expect(result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY).toBe(2);
  });

  it('designs column shear and tightens ties when the concrete is not enough', () => {
    const light = assertColumn({ ...column, shearYKn: 50 });
    const heavy = assertColumn({ ...column, shearYKn: 400 });
    expect(light.ties.shear.y.steelRequiredKn).toBe(0);
    expect(heavy.ties.shear.y.steelRequiredKn).toBeGreaterThan(0);
    expect(heavy.ties.centerSpacingMm).toBeLessThan(light.ties.centerSpacingMm);
    expect(heavy.ties.shear.y.strengthKn).toBeGreaterThanOrEqual(400);
  });

  it('fails a column that buckles before reaching the load', () => {
    const result = assertColumn({ ...column, unbracedLengthM: 10 });
    expect(result.magnification.x.unstable).toBe(true);
    expect(result.status).toBe('fail');
  });

  it('flags an overloaded column', () => {
    const result = assertColumn({ ...column, axialKn: 5_000 });
    expect(result.status).toBe('fail');
  });
});

const footing: FootingDesignInput = {
  code: 'ntc-2023', columnWidthMm: 400, columnDepthMm: 400, deadKn: 600, liveKn: 300, combinations: ntcB(),
  serviceMomentXKnm: 0, serviceMomentYKnm: 0, ultimateMomentXKnm: 0, ultimateMomentYKnm: 0,
  allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420, thicknessMm: 500, sideXMm: null, sideYMm: null, coverMm: 75, barDiameterMm: 15.9,
  seismicCombination: false,
};

const assertFooting = (input: FootingDesignInput) => {
  const result = designFooting(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result;
};

describe('designFooting', () => {
  it('sizes a concentric footing from the allowable pressure', () => {
    const result = assertFooting(footing);
    expect(result.sideXMm).toBe(2_450);
    expect(result.sideYMm).toBe(2_450);
    expect(result.service.maximumKpa).toBeLessThanOrEqual(150);
  });

  it('computes punching shear by hand', () => {
    const result = assertFooting(footing);
    const d = 500 - 75 - 15.9;
    const qu = (1.3 * 600 + 1.5 * 300) / 2.45 ** 2 / 1e3;
    const b = 400 + d;
    expect(result.punching.demandKn).toBeCloseTo(qu * (2_450 ** 2 - b * b) / 1e3, 6);
    const lambdaS = Math.sqrt(2 / (1 + 0.004 * d));
    expect(result.punching.sizeFactor).toBeCloseTo(lambdaS, 12);
    expect(result.punching.strengthKn).toBeCloseTo(0.75 * 0.33 * lambdaS * 5 * 4 * b * d / 1e3, 6);
    const seismic = assertFooting({ ...footing, seismicCombination: true });
    expect(seismic.punching.strengthKn / result.punching.strengthKn).toBeCloseTo(0.65 / 0.75, 12);
    expect(result.punching.demandStressMpa).toBeCloseTo(result.punching.demandKn * 1e3 / (4 * b * d), 9);
  });

  it('computes the face moment of a concentric footing by hand', () => {
    const result = assertFooting(footing);
    const qu = (1.3 * 600 + 1.5 * 300) / 2.45 ** 2; // kPa
    const arm = (2.45 - 0.4) / 2;
    expect(result.directions.x.momentKnm).toBeCloseTo(qu * 2.45 * arm ** 2 / 2, 6);
    expect(result.directions.x.band).toBeNull();
  });

  it('computes one-way shear without stirrups with the size effect and ρ^(1/3) (5.5.3.2.1)', () => {
    const result = assertFooting(footing);
    const x = result.directions.x;
    const width = result.sideYMm;
    const expected = 0.75 * 0.66 * sizeFactor(x.effectiveDepthMm) * Math.cbrt(x.providedMm2 / (width * x.effectiveDepthMm)) * 5 * width * x.effectiveDepthMm / 1e3;
    expect(x.oneWayStrengthKn).toBeCloseTo(expected, 6);
    // Con la cuantía mínima el cortante sin estribos resulta bastante menor que 0.17√f′c.
    expect(x.oneWayStrengthKn).toBeLessThan(0.75 * 0.17 * 5 * width * x.effectiveDepthMm / 1e3);
  });

  it('checks the anchorage of the footing bars from the column face', () => {
    const result = assertFooting(footing);
    const anchorage = result.checks.find((check) => check.id === 'anchorage-x')!;
    expect(anchorage.demand).toBeCloseTo(result.directions.x.developmentLengthMm, 9);
    expect(anchorage.capacity).toBeCloseTo((2_450 - 400) / 2 - 75, 9);
    expect(result.checks.find((check) => check.id === 'min-depth')!.status).toBe('pass');
  });

  it('finds the minimum thickness when left automatic', () => {
    const result = assertFooting({ ...footing, thicknessMm: null });
    expect(result.checks.find((item) => item.id === 'punching')!.status).toBe('pass');
    const thinner = assertFooting({ ...footing, thicknessMm: result.thicknessMm - 50 });
    expect(thinner.checks.some((item) => ['punching', 'one-way-x', 'one-way-y'].includes(item.id) && item.status === 'fail')).toBe(true);
  });

  it('grows the footing in the direction of the eccentricity until the resultant stays in the kern', () => {
    const result = assertFooting({ ...footing, serviceMomentYKnm: 200, ultimateMomentYKnm: 290 });
    expect(result.sideXMm).toBeGreaterThan(result.sideYMm);
    expect(result.service.eccentricityXMm).toBeCloseTo(200 / 900 * 1e3, 9);
    expect(result.service.minimumKpa).toBeGreaterThanOrEqual(0);
    expect(result.service.maximumKpa).toBeLessThanOrEqual(150 + 1e-9);
    const p = 900;
    const area = result.sideXMm * result.sideYMm / 1e6;
    expect(result.service.maximumKpa).toBeCloseTo(p / area * (1 + 6 * (200 / 900 * 1e3) / result.sideXMm), 6);
  });

  it('adds moment transfer to punching and a central band for the short bars', () => {
    const concentric = assertFooting({ ...footing, sideXMm: 3_000, sideYMm: 2_000 });
    const eccentric = assertFooting({ ...footing, sideXMm: 3_000, sideYMm: 2_000, serviceMomentYKnm: 100, ultimateMomentYKnm: 150 });
    expect(eccentric.punching.demandStressMpa).toBeGreaterThan(concentric.punching.demandStressMpa);
    expect(concentric.directions.x.layer).toBe('bottom');
    const band = concentric.directions.y.band!;
    expect(band.widthMm).toBe(2_000);
    expect(band.barsInBand).toBe(Math.ceil(concentric.directions.y.barCount * 2 / (1.5 + 1)));
  });

  it('fails when fixed dimensions leave the resultant outside the kern', () => {
    const result = assertFooting({ ...footing, sideXMm: 2_000, sideYMm: 2_000, serviceMomentYKnm: 400, ultimateMomentYKnm: 550 });
    expect(result.checks.find((item) => item.id === 'kern')!.status).toBe('fail');
    expect(result.status).toBe('fail');
  });
});

describe('NTC 2023 building blocks', () => {
  it('reduces FR in the transition zone of table 3.8.2.2', () => {
    const fc = 25;
    const fy = 420;
    const b = 300;
    const d = 540;
    const balanced = 0.85 * fc / fy * (600 * 0.85 / (fy + 600)) * b * d;
    const nearMaximum = flexuralCapacity(0.9 * balanced, b, d, fy, fc);
    const light = flexuralCapacity(0.25 * balanced, b, d, fy, fc);
    expect(light.resistanceFactor).toBe(0.9);
    expect(nearMaximum.resistanceFactor).toBeGreaterThan(0.65);
    expect(nearMaximum.resistanceFactor).toBeLessThan(0.75);
    const required = requiredFlexuralSteelMm2(0.95 * nearMaximum.strengthKnm, b, d, fy, fc)!;
    expect(flexuralCapacity(required, b, d, fy, fc).strengthKnm).toBeGreaterThanOrEqual(0.95 * nearMaximum.strengthKnm - 1e-6);
  });

  it('computes NTC 2023 development lengths (table 14.4.2.4)', () => {
    const favorable = developmentLength({ diameterMm: 15.9, fyMpa: 412, fcMpa: 24.5, topBar: false, clearSpacingMm: 40, clearCoverMm: 50, minimumStirrups: true });
    expect(favorable.favorable).toBe(true);
    expect(favorable.lengthMm).toBeCloseTo(412 / (2.1 * Math.sqrt(24.5)) * 15.9, 9);
    const top = developmentLength({ diameterMm: 25.4, fyMpa: 412, fcMpa: 24.5, topBar: true, clearSpacingMm: 20, clearCoverMm: 50, minimumStirrups: false });
    expect(top.favorable).toBe(false);
    expect(top.lengthMm).toBeCloseTo(412 * 1.3 / (1.1 * Math.sqrt(24.5)) * 25.4, 9);
    expect(developmentLength({ diameterMm: 9.5, fyMpa: 412, fcMpa: 40, topBar: false, clearSpacingMm: 100, clearCoverMm: 50, minimumStirrups: true }).lengthMm).toBe(300);
  });

  it('uses 0.9 on dead load where it is favorable (overhang, NTC-CyA 3.4.1 c)', () => {
    const overhang: BeamDesignInput = {
      ...beam,
      spans: [span(6, 10, 0), span(2, 10, 0)],
      leftEnd: 'pin',
      rightEnd: 'free',
      combinations: ntcB(0.9),
    };
    const result = assertBeam(overhang);
    // Claro trasero con 1.3·w y voladizo con 0.9·w: M⁻ = 18, R = 39 − 3 = 36, M⁺ = 36²/(2·13).
    expect(result.extremes.positiveMomentKnm).toBeCloseTo(36 ** 2 / 26, 6);
    expect(result.extremes.negativeMomentKnm).toBeCloseTo(1.3 * 10 * 4 / 2, 6);
  });

  it('adds the sustained live load to the long-term deflection', () => {
    const none = assertBeam({ ...beam, sustainedLiveRatio: 0 });
    const some = assertBeam({ ...beam, sustainedLiveRatio: 0.4 });
    expect(some.spans[0]!.deflectionMm).toBeGreaterThan(none.spans[0]!.deflectionMm);
    expect(some.spans[0]!.immediateMm).toBeCloseTo(none.spans[0]!.immediateMm, 9);
    expect(none.checks.find((check) => check.id === 'crack-spacing')!.status).toBe('pass');
  });

  it('rejects spans shorter than 5h for the flexural provisions (5.2.1.1.2)', () => {
    const deep = assertBeam({ ...beam, spans: [span(2.5)] });
    expect(deep.checks.find((check) => check.id === 'deep-beam')!.status).toBe('fail');
  });
});
