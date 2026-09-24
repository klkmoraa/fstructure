/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { designBeam, type BeamDesignInput } from './beam';
import { DESIGN_CODE_IDS, designCode, type DesignCodeId } from './codes';
import { designColumn, type ColumnDesignInput } from './column';
import { designFooting, type FootingDesignInput } from './footing';
import { barArea, betaOne, flexuralCapacity, requiredFlexuralSteelMm2, type ElementCheck } from './shared';

const span = (lengthM: number, deadKnPerM = 20, liveKnPerM = 10) => ({ lengthM, deadKnPerM, liveKnPerM, pointDeadKn: 0, pointLiveKn: 0, pointAtM: lengthM / 2 });

const beamFor = (code: DesignCodeId, overrides: Partial<BeamDesignInput> = {}): BeamDesignInput => ({
  code, widthMm: 300, heightMm: 600, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420,
  spans: [span(6)], leftEnd: 'pin', rightEnd: 'pin', includeSelfWeight: false,
  combinations: designCode(code).loadCombinations('B'), sustainedLiveRatio: 0.25, longTermXi: 2,
  barDiameterMm: null, stirrupDiameterMm: null, maxAggregateMm: 19, damagesNonstructural: false, supportWidthMm: 450,
  ...overrides,
});

const columnFor = (code: DesignCodeId, overrides: Partial<ColumnDesignInput> = {}): ColumnDesignInput => ({
  code, widthMm: 400, depthMm: 400, coverMm: 40, fcMpa: 28, fyMpa: 420, barDiameterMm: 25.4,
  barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5, maxAggregateMm: 19, axialKn: 1_000, momentXKnm: 100, momentYKnm: 0,
  shearXKn: 0, shearYKn: 0, unbracedLengthM: 2.4, effectiveLengthFactor: 1, curvature: 'single', endMomentRatio: 1, sustainedRatio: 0.6,
  braced: true, swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0, group: 'B2', groundFloor: false,
  ...overrides,
});

const footingFor = (code: DesignCodeId, overrides: Partial<FootingDesignInput> = {}): FootingDesignInput => ({
  code, columnWidthMm: 400, columnDepthMm: 400, deadKn: 600, liveKn: 300, combinations: designCode(code).loadCombinations('B'),
  serviceMomentXKnm: 0, serviceMomentYKnm: 0, ultimateMomentXKnm: 0, ultimateMomentYKnm: 0,
  allowablePressureKpa: 150, fcMpa: 25, fyMpa: 420, thicknessMm: 550, sideXMm: null, sideYMm: null, coverMm: 75, barDiameterMm: 15.9,
  seismicCombination: false,
  ...overrides,
});

const ok = <T,>(result: { ok: true } & T | { ok: false; errors: readonly string[] }): T => {
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result;
};
const check = (checks: readonly ElementCheck[], id: string) => {
  const found = checks.find((item) => item.id === id);
  if (!found) throw new Error(`Falta la comprobación ${id}`);
  return found;
};

describe('load combinations by code', () => {
  it('uses max(1.4D, 1.2D + 1.6L) in NSR-10 C.9.2.1', () => {
    const deadOnly = ok(designBeam(beamFor('nsr-10', { spans: [span(6, 20, 0)] })));
    expect(deadOnly.extremes.positiveMomentKnm).toBeCloseTo(1.4 * 20 * 36 / 8, 6);
    const withLive = ok(designBeam(beamFor('nsr-10')));
    expect(withLive.extremes.positiveMomentKnm).toBeCloseTo((1.2 * 20 + 1.6 * 10) * 36 / 8, 6);
  });

  it('uses 1.4 CM + 1.7 CV in E.060 9.2.1', () => {
    const result = ok(designBeam(beamFor('e060')));
    expect(result.extremes.positiveMomentKnm).toBeCloseTo((1.4 * 20 + 1.7 * 10) * 36 / 8, 6);
  });

  it('keeps the NTC groups and the favorable 0.9 dead-load factor', () => {
    expect(designCode('ntc-2023').loadCombinations('A')).toEqual([{ label: '1.5 CM + 1.7 CV (Grupo A)', dead: 1.5, favorableDead: 0.9, live: 1.7 }]);
    expect(designCode('nsr-10').loadCombinations('A').every((combination) => combination.favorableDead === combination.dead)).toBe(true);
  });
});

describe('resistance factors and steel limits by code', () => {
  const yieldStrain = 420 / 200_000;

  it('interpolates NSR-10 φ from εty to 0.005 (C.9.3.2.2)', () => {
    const phi = designCode('nsr-10').flexureFactor;
    expect(phi(yieldStrain, yieldStrain)).toBe(0.65);
    expect(phi(0.004, yieldStrain)).toBeCloseTo(0.65 + 0.25 * (0.004 - yieldStrain) / (0.005 - yieldStrain), 12);
    expect(phi(0.005, yieldStrain)).toBe(0.9);
    // La NTC llega a 0.90 en εty + 0.003 = 0.0051.
    expect(designCode('ntc-2023').flexureFactor(0.005, yieldStrain)).toBeLessThan(0.9);
  });

  it('keeps φ = 0.90 in E.060 flexure and raises the column φ from 0.70 to 0.90 at low axial load (9.3.2.2)', () => {
    const e060 = designCode('e060');
    expect(e060.flexureFactor(0.002, yieldStrain)).toBe(0.9);
    const lowAxialN = 500_000;
    expect(e060.columnFactor({ netStrain: 0, yieldStrain, axialN: 0, lowAxialN })).toBe(0.9);
    expect(e060.columnFactor({ netStrain: 0, yieldStrain, axialN: lowAxialN / 0.7, lowAxialN })).toBeCloseTo(0.7, 12);
    expect(e060.columnFactor({ netStrain: 0, yieldStrain, axialN: 2 * lowAxialN, lowAxialN })).toBe(0.7);
    expect(e060.columnFactor({ netStrain: 0, yieldStrain, axialN: -1, lowAxialN })).toBe(0.9);
  });

  it('limits tension steel: εt ≥ 0.004 (NSR C.10.3.5) and 0.75Asb (E.060 10.3.4)', () => {
    const nsr = designCode('nsr-10').beam.maximumSteel(300, 540, 540, 25, 420);
    expect(nsr).toBeCloseTo(0.85 * 25 * betaOne(25) * (3 / 7) * 540 * 300 / 420, 9);
    const balanced = 0.85 * 25 / 420 * (600 * 0.85 / 1_020) * 300 * 540;
    expect(designCode('e060').beam.maximumSteel(300, 540, 540, 25, 420)).toBeCloseTo(0.75 * balanced, 9);
    // En el límite de NSR la sección queda con εt = 0.004 exactamente.
    const atLimit = flexuralCapacity(nsr, 300, 540, 420, 25, 540, designCode('nsr-10').flexureFactor);
    expect(atLimit.netTensileStrain).toBeCloseTo(0.004, 9);
  });

  it('requires E.060 minimum steel for φMn ≥ 1.2Mcr and 0.22√f′c bw d/fy (10.5.1-10.5.2)', () => {
    const minimum = designCode('e060').beam.minimumSteel(300, 540, 600, 25, 420, 540);
    const cracking = 0.62 * 5 * 300 * 600 ** 2 / 6 / 1e6;
    const forCracking = requiredFlexuralSteelMm2(1.2 * cracking, 300, 540, 420, 25, 540, () => 0.9, (strain) => strain)!;
    expect(minimum).toBeCloseTo(Math.max(0.22 * 5 * 300 * 540 / 420, forCracking), 9);
    expect(designCode('nsr-10').beam.minimumSteel(300, 540, 600, 25, 420, 540)).toBeCloseTo(1.4 * 300 * 540 / 420, 9);
  });

  it('caps φPn,max with 0.75φP0 (NSR C.10.3.6.2) and 0.80φP0 (E.060 10.3.6.2)', () => {
    const steel = 8 * barArea(25.4);
    const p0 = (0.85 * 28 * (160_000 - steel) + 420 * steel) / 1e3;
    expect(ok(designColumn(columnFor('nsr-10'))).maximumDesignAxialKn).toBeCloseTo(0.75 * 0.65 * p0, 6);
    expect(ok(designColumn(columnFor('e060'))).maximumDesignAxialKn).toBeCloseTo(0.8 * 0.7 * p0, 6);
    expect(ok(designColumn(columnFor('ntc-2023'))).maximumDesignAxialKn).toBeCloseTo(0.65 * p0, 6);
  });
});

describe('development, hooks and splices by code', () => {
  it('uses the favorable rows of each table and E.060 ec. 12-1 otherwise', () => {
    const favorable = { diameterMm: 15.9, fyMpa: 420, fcMpa: 25, topBar: false, clearSpacingMm: 40, clearCoverMm: 50, minimumStirrups: true };
    expect(designCode('nsr-10').developmentLength(favorable).lengthMm).toBeCloseTo(420 / (2.1 * 5) * 15.9, 9);
    expect(designCode('e060').developmentLength(favorable).lengthMm).toBeCloseTo(420 / (2.6 * 5) * 15.9, 9);
    const tight = { diameterMm: 25.4, fyMpa: 420, fcMpa: 25, topBar: false, clearSpacingMm: 30, clearCoverMm: 40, minimumStirrups: false };
    expect(designCode('nsr-10').developmentLength(tight).lengthMm).toBeCloseTo(420 / (1.1 * 5) * 25.4, 9);
    const cb = Math.min(40 + 12.7, (30 + 25.4) / 2);
    expect(designCode('e060').developmentLength(tight).lengthMm).toBeCloseTo(420 / (1.1 * 5) * (1 / (cb / 25.4)) * 25.4, 9);
    expect(designCode('nsr-10').developmentLength({ ...tight, topBar: true }).lengthMm).toBeCloseTo(1.3 * 420 / (1.1 * 5) * 25.4, 9);
  });

  it('computes standard-hook development and Class B splices', () => {
    for (const id of DESIGN_CODE_IDS) {
      const code = designCode(id);
      expect(code.hookedDevelopmentMm(15.9, 420, 25)).toBeCloseTo(0.24 * 420 / 5 * 15.9, 9);
      expect(code.hookedDevelopmentMm(9.5, 420, 70)).toBe(150);
      const development = code.developmentLength({ diameterMm: 19.1, fyMpa: 420, fcMpa: 25, topBar: false, clearSpacingMm: 60, clearCoverMm: 50, minimumStirrups: true });
      expect(code.spliceLengthMm(development)).toBeCloseTo(Math.max(1.3 * development.computedMm, 300), 9);
    }
  });

  it('anchors beam bars at fixed ends: straight, hooked or insufficient', () => {
    const wide = ok(designBeam(beamFor('ntc-2023', { leftEnd: 'fixed', rightEnd: 'fixed', supportWidthMm: 2_000 })));
    expect(wide.anchorages.map((item) => item.kind)).toEqual(['straight', 'straight']);
    const hooked = ok(designBeam(beamFor('ntc-2023', { leftEnd: 'fixed', rightEnd: 'fixed', supportWidthMm: 600 })));
    const first = hooked.anchorages[0]!;
    expect(first.bed).toBe('top');
    expect(first.hookMm).toBeCloseTo(designCode('ntc-2023').hookedDevelopmentMm(first.diameterMm, 420, 25), 9);
    expect(first.kind).toBe(first.straightMm <= 560 ? 'straight' : first.hookMm <= 560 ? 'hook' : 'insufficient');
    const narrow = ok(designBeam(beamFor('ntc-2023', { leftEnd: 'fixed', rightEnd: 'fixed', supportWidthMm: 200 })));
    expect(check(narrow.checks, 'anchorage').status).toBe('fail');
    // Apoyos simples: sin momento en el extremo no se exige desarrollo.
    expect(ok(designBeam(beamFor('ntc-2023'))).anchorages).toEqual([]);
  });
});

describe('beam serviceability by code', () => {
  it('checks ACI-type deflections: immediate live ℓ/360 and after attachment ℓ/240 or ℓ/480', () => {
    const result = ok(designBeam(beamFor('nsr-10')));
    const live = check(result.checks, 'deflection-live');
    expect(live.capacity).toBeCloseTo(6_000 / 360, 9);
    expect(check(result.checks, 'deflection').capacity).toBeCloseTo(6_000 / 240, 9);
    const sensitive = ok(designBeam(beamFor('nsr-10', { damagesNonstructural: true })));
    expect(check(sensitive.checks, 'deflection').capacity).toBeCloseTo(6_000 / 480, 9);
    expect(result.spans[0]!.checkedDeflectionMm).toBeLessThan(result.spans[0]!.deflectionMm + result.spans[0]!.liveDeflectionMm!);
  });

  it('uses Branson in NSR-10 (C.9-8) and the cracked inertia in E.060 (9.6.2.3)', () => {
    const heavy = { spans: [span(6, 30, 20)] };
    const gross = 300 * 600 ** 3 / 12;
    const crackedOf = (result: { cuts: readonly { label: string; bottom: { areaMm2: number; effectiveDepthMm: number } }[] }) => {
      const section = result.cuts.find((cut) => cut.label.startsWith('Claro'))!.bottom;
      const n = 200_000 / (4_700 * 5);
      const nas = n * section.areaMm2;
      const kd = (-nas + Math.sqrt(nas ** 2 + 2 * 300 * nas * section.effectiveDepthMm)) / 300;
      return 300 * kd ** 3 / 3 + nas * (section.effectiveDepthMm - kd) ** 2;
    };
    const nsr = ok(designBeam(beamFor('nsr-10', heavy)));
    const ratio = (0.62 * 5 * gross / 300 / 1e6 / (50 * 36 / 8)) ** 3;
    expect(nsr.spans[0]!.effectiveInertiaRatio).toBeCloseTo((ratio * gross + (1 - ratio) * crackedOf(nsr)) / gross, 9);
    const e060 = ok(designBeam(beamFor('e060', heavy)));
    expect(e060.spans[0]!.effectiveInertiaRatio).toBeCloseTo(crackedOf(e060) / gross, 9);
  });

  it('computes the E.060 crack parameter Z = fs·∛(dc·Act) with fs = Ms/(0.9·d·As)', () => {
    const result = ok(designBeam(beamFor('e060')));
    const crack = check(result.checks, 'crack-z');
    const service = (20 + 10) * 36 / 8;
    const section = result.cuts.find((cut) => cut.label.startsWith('Claro'))!.bottom;
    const fs = service * 1e6 / (0.9 * section.effectiveDepthMm * section.areaMm2);
    const bars = section.areaMm2 / barArea(Math.max(section.continuous.diameterMm, section.extra?.diameterMm ?? 0));
    const act = 2 * (600 - section.effectiveDepthMm) * 300 / bars;
    expect(crack.demand).toBeCloseTo(fs * Math.cbrt((600 - section.extremeDepthMm) * act) / 1e3, 6);
    expect(crack.capacity).toBe(26);
  });

  it('flags deep beams at ℓn ≤ 4h in ACI-type codes', () => {
    expect(check(ok(designBeam(beamFor('nsr-10', { spans: [span(2.4)] }))).checks, 'deep-beam').status).toBe('fail');
    expect(ok(designBeam(beamFor('nsr-10', { spans: [span(2.5)] }))).checks.some((item) => item.id === 'deep-beam')).toBe(false);
  });
});

describe('column slenderness by code', () => {
  it('uses r = 0.3h and the 34 − 12 M1/M2 ≤ 40 limit in NSR-10 and E.060', () => {
    const nsr = ok(designColumn(columnFor('nsr-10', { unbracedLengthM: 4, curvature: 'double' })));
    expect(nsr.magnification.x.slenderness).toBeCloseTo(4_000 / 120, 9);
    expect(nsr.magnification.x.limit).toBe(40);
    expect(nsr.magnification.x.slender).toBe(false);
  });

  it('applies M2,min = Pu(15 + 0.03h) only to slender ACI-type columns', () => {
    const short = ok(designColumn(columnFor('e060', { momentXKnm: 1 })));
    expect(short.magnification.x.designMomentKnm).toBe(1);
    const slender = ok(designColumn(columnFor('e060', { momentXKnm: 1, unbracedLengthM: 5 })));
    expect(slender.magnification.x.minimumMomentKnm).toBeCloseTo(1_000 * (15 + 0.03 * 400) / 1e3, 9);
    expect(slender.magnification.x.cm).toBe(1);
  });

  it('magnifies sway moments with δs = 1/(1 − Q) and rejects δs > 1.5', () => {
    const sway = { braced: false, swayMomentXKnm: 50, stabilityIndex: 0.2 };
    const ntc = ok(designColumn(columnFor('ntc-2023', sway)));
    expect(ntc.magnification.x.swayFactor).toBeCloseTo(1.25, 12);
    expect(ntc.magnification.x.designMomentKnm).toBeCloseTo(100 + 1.25 * 50, 9);
    expect(check(ntc.checks, 'slenderness').status).toBe('pass');
    expect(check(ok(designColumn(columnFor('ntc-2023', { ...sway, stabilityIndex: 0.4 }))).checks, 'slenderness').status).toBe('fail');
    // NSR: kℓu/r = 2400/120 = 20 ≤ 22 → se desprecia; con 4 m se amplifica.
    expect(ok(designColumn(columnFor('nsr-10', sway))).magnification.x.designMomentKnm).toBeCloseTo(150, 9);
    const tall = ok(designColumn(columnFor('nsr-10', { ...sway, unbracedLengthM: 4 })));
    expect(tall.magnification.x.designMomentKnm).toBeCloseTo(100 + 1.25 * 50, 9);
    // E.060 10.13.6 b: Q ≤ 0.60.
    expect(check(ok(designColumn(columnFor('e060', { ...sway, stabilityIndex: 0.62, unbracedLengthM: 4 }))).checks, 'slenderness').status).toBe('fail');
    expect(designColumn(columnFor('e060', { ...sway, effectiveLengthFactor: 0.8 })).ok).toBe(false);
  });

  it('limits the second-order moment to 1.4 times the first-order one in NSR-10 (C.10.10.2.1)', () => {
    const result = ok(designColumn(columnFor('nsr-10', { unbracedLengthM: 6, axialKn: 1_400 })));
    const ratio = result.magnification.x.designMomentKnm / result.magnification.x.firstOrderMomentKnm;
    expect(check(result.checks, 'slenderness').status).toBe(ratio > 1.4 ? 'fail' : 'pass');
    expect(ratio).toBeGreaterThan(1.4);
  });

  it('details ACI ties: 16db, 48de, least dimension and the 150 mm rule', () => {
    const result = ok(designColumn(columnFor('nsr-10', { barsAlongWidth: 4, barsAlongDepth: 4, barDiameterMm: 19.1 })));
    expect(result.ties.endLengthMm).toBe(0);
    expect(result.ties.centerSpacingMm).toBeLessThanOrEqual(Math.min(16 * 19.1, 48 * 9.5, 400));
    // Separación libre ≈ 76 mm ≤ 150: basta apoyar barras alternas → una grapa por cara de 4 barras.
    expect(result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY).toBe(2);
    expect(result.checks.some((item) => item.id === 'hx')).toBe(false);
    expect(check(ok(designColumn(columnFor('e060', { barDiameterMm: 25.4, tieDiameterMm: 9.5 }))).checks, 'tie-diameter').status).toBe('pass');
    expect(check(ok(designColumn(columnFor('e060', { barDiameterMm: 31.8, tieDiameterMm: 9.5 }))).checks, 'tie-diameter').status).toBe('fail');
  });

  it('computes ACI column shear with Vc = 0.17(1 + Nu/14Ag)√f′c·b·d', () => {
    const result = ok(designColumn(columnFor('e060', { shearYKn: 100 })));
    const d = 400 - 40 - 9.5 - 12.7;
    expect(result.ties.shear.y.concreteStrengthKn).toBeCloseTo(0.85 * 0.17 * (1 + 1e6 / (14 * 160_000)) * Math.sqrt(28) * 400 * d / 1e3, 6);
  });
});

describe('footings by code', () => {
  it('uses Vc = 0.17√f′c·b·d for one-way shear in NSR-10 and E.060', () => {
    for (const id of ['nsr-10', 'e060'] as const) {
      const result = ok(designFooting(footingFor(id)));
      const x = result.directions.x;
      expect(x.oneWayStrengthKn).toBeCloseTo(designCode(id).shearFactor * 0.17 * 5 * result.sideYMm * x.effectiveDepthMm / 1e3, 6);
      expect(result.punching.sizeFactor).toBe(1);
    }
  });

  it('requires 300 mm over the bottom steel in E.060 15.7', () => {
    const thin = ok(designFooting(footingFor('e060', { thicknessMm: 350 })));
    expect(check(thin.checks, 'min-depth').status).toBe('fail');
    expect(check(ok(designFooting(footingFor('nsr-10', { thicknessMm: 350 }))).checks, 'min-depth').status).toBe('pass');
  });

  it('adds the NTC 6.7.6.1.2 minimum steel when vuv > 0.17·FR·λs·√f′c', () => {
    const result = ok(designFooting(footingFor('ntc-2023')));
    const { punching } = result;
    expect(punching.directStressMpa).toBeGreaterThan(0.17 * 0.75 * punching.sizeFactor * 5);
    const x = result.directions.x;
    expect(x.punchingMinimumMm2).toBeCloseTo(5 * punching.directStressMpa * punching.perimeterMm / (0.75 * 40 * 420) * result.sideYMm, 6);
    expect(x.providedMm2).toBeGreaterThanOrEqual(x.punchingMinimumMm2);
    expect(ok(designFooting(footingFor('nsr-10'))).directions.x.punchingMinimumMm2).toBe(0);
  });

  it('limits bar spacing: NTC 2h ≤ 450, NSR 3h ≤ 450, E.060 3h ≤ 400', () => {
    expect(ok(designFooting(footingFor('ntc-2023', { thicknessMm: 200, coverMm: 50, barDiameterMm: 9.5, deadKn: 100, liveKn: 50 }))).directions.x.maximumSpacingMm).toBe(400);
    expect(ok(designFooting(footingFor('nsr-10'))).directions.x.maximumSpacingMm).toBe(450);
    expect(ok(designFooting(footingFor('e060'))).directions.x.maximumSpacingMm).toBe(400);
  });

  it('checks straight anchorage first and a standard hook when it does not fit', () => {
    const shortCantilever = ok(designFooting(footingFor('nsr-10', { sideXMm: 1_400, sideYMm: 1_400, deadKn: 150, liveKn: 60, barDiameterMm: 19.1 })));
    const x = shortCantilever.directions.x;
    expect(x.availableAnchorageMm).toBeCloseTo((1_400 - 400) / 2 - 75, 9);
    expect(x.anchorage).toBe(x.developmentLengthMm <= x.availableAnchorageMm ? 'straight' : x.hookLengthMm <= x.availableAnchorageMm ? 'hook' : 'insufficient');
    expect(x.anchorage).not.toBe('straight');
  });
});

describe('normative evidence of every cited clause', () => {
  it('cites only clauses registered for the standard of each check', () => {
    const registry = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/design/normative-sources.json'), 'utf8')) as {
      standards: { id: string; verifiedClauses: { clauseId: string }[] }[];
    };
    const verified = new Map(registry.standards.map((standard) => [standard.id, new Set(standard.verifiedClauses.map((clause) => clause.clauseId))]));
    const cited = new Set<string>();
    for (const id of DESIGN_CODE_IDS) {
      const code = designCode(id);
      const checks: ElementCheck[] = [
        ...ok(designBeam(beamFor(id, { spans: [span(6, 30, 20), span(2, 10, 5)], rightEnd: 'free', leftEnd: 'fixed', supportWidthMm: 300 }))).checks,
        ...ok(designBeam(beamFor(id, { spans: [span(2.2)], widthMm: 200, heightMm: 300 }))).checks,
        ...ok(designColumn(columnFor(id, { momentYKnm: 60, shearXKn: 300, unbracedLengthM: 5, axialKn: -50 }))).checks,
        ...ok(designColumn(columnFor(id, { widthMm: 250, depthMm: 250, barDiameterMm: 15.9, group: 'A' }))).checks,
        ...ok(designColumn(columnFor(id, { braced: false, swayMomentXKnm: 40, stabilityIndex: 0.1, effectiveLengthFactor: 1.5, unbracedLengthM: 4 }))).checks,
        ...ok(designFooting(footingFor(id, { serviceMomentYKnm: 100, ultimateMomentYKnm: 150, seismicCombination: true }))).checks,
        ...ok(designFooting(footingFor(id, { sideXMm: 2_000, sideYMm: 2_000, serviceMomentYKnm: 400, ultimateMomentYKnm: 550 }))).checks,
      ];
      const references = [...checks.map((item) => item.reference), ...Object.values(code.refs)];
      for (const reference of references) {
        if (reference.standard === 'complementary') {
          expect(reference.clauseIds).toEqual([]);
          continue;
        }
        expect(reference.clauseIds.length, reference.label).toBeGreaterThan(0);
        for (const clauseId of reference.clauseIds) {
          expect(verified.get(reference.standard)?.has(clauseId), `${id}: ${reference.label} cita ${clauseId} sin evidencia registrada`).toBe(true);
          cited.add(`${reference.standard}:${clauseId}`);
        }
      }
      // Ninguna comprobación de una norma cita a otra (salvo NTC-CyA dentro de la NTC).
      const foreign = checks.filter((item) => item.reference.standard !== 'complementary'
        && !(id === 'ntc-2023' ? ['ntc-cdmx-2023-concrete', 'ntc-cdmx-2023-criteria-actions'] : [id === 'nsr-10' ? 'nsr-10-titulo-c' : 'e060-2009-concreto-armado']).includes(item.reference.standard));
      expect(foreign.map((item) => item.id)).toEqual([]);
    }
    // Cada cláusula registrada para NSR-10 y E.060 la usa algún perfil.
    for (const standard of ['nsr-10-titulo-c', 'e060-2009-concreto-armado']) {
      const unused = [...verified.get(standard)!].filter((clauseId) => !cited.has(`${standard}:${clauseId}`));
      expect(unused, standard).toEqual([]);
    }
  });
});
