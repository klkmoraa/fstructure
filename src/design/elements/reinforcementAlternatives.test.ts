import { describe, expect, it } from 'vitest';
import { designFlexureExercise, type FlexureExerciseInput } from './flexureExercise';
import { reinforcementAlternatives, type ReinforcementAlternativesRequest } from './reinforcementAlternatives';
import { designColumn, type ColumnDesignInput } from './column';
import type { SectionStudioInput } from '../concrete/sectionStudio';

const flexure: FlexureExerciseInput = {
  code: 'ntc-2023', widthMm: 300, heightMm: 550, coverMm: 35, fcMpa: 25, fyMpa: 420,
  stirrupDiameterMm: 9.5, aggregateMm: 19, momentKnM: 180,
  top: { count: 2, diameterMm: 16 }, bottom: { count: 3, diameterMm: 19.1 },
};
const column: ColumnDesignInput = {
  code: 'ntc-2023', shape: 'rectangular', widthMm: 400, depthMm: 400, coverMm: 40, fcMpa: 25, fyMpa: 420,
  barDiameterMm: 19.1, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5, maxAggregateMm: 19,
  axialKn: 900, momentXKnm: 80, momentYKnm: 40, shearXKn: 0, shearYKn: 0, unbracedLengthM: 3,
  effectiveLengthFactor: 1, curvature: 'single', endMomentRatio: 1, sustainedRatio: 0.6, braced: true,
  swayMomentXKnm: 0, swayMomentYKnm: 0, stabilityIndex: 0, group: 'B2', groundFloor: false,
};
const section: SectionStudioInput = {
  shape: 'square', widthMm: 400, heightMm: 400, coverMm: 40, fcMpa: 30, fyMpa: 420, barDiameterMm: 20, barCount: 8,
  tieDiameterMm: 10, tieSpacingMm: 150, tieType: 'closed', lengthM: 3, axialKn: 400, momentKnm: 50, shearKn: 0,
  angleDeg: 0, philosophy: 'ultimate', phi: 0.65, gammaConcrete: 1.5, gammaSteel: 1.15, allowableConcreteRatio: 0.45, allowableSteelRatio: 0.6,
};

describe('reinforcement alternatives', () => {
  it('keeps fixed geometry and evaluates every returned flexure candidate with the real engine', () => {
    const request: ReinforcementAlternativesRequest = { kind: 'flexure', requestId: 1, input: flexure, objective: 'minimum-steel' };
    const response = reinforcementAlternatives(request);
    expect(response.kind).toBe('alternatives');
    if (response.kind !== 'alternatives') return;
    expect(response.candidates.length).toBeGreaterThan(0);
    expect(response.candidates.length).toBeLessThanOrEqual(3);
    for (const candidate of response.candidates) {
      expect(candidate.geometry).toEqual({ widthMm: 300, heightMm: 550 });
      const reevaluated = designFlexureExercise({ ...flexure, [candidate.reinforcement.bed]: candidate.reinforcement.group });
      expect(reevaluated.checks.filter((check) => check.status !== 'out-of-scope').every((check) => check.status === 'pass')).toBe(true);
      expect(candidate.checked.status).toBe('pass');
      expect(candidate.reinforcement.diametersMm.every((diameter) => diameter === candidate.reinforcement.group.diameterMm)).toBe(true);
    }
  });

  it('limits available-bars choices to the explicit catalog subset and rejects empty stock', () => {
    const subset = reinforcementAlternatives({ kind: 'flexure', requestId: 2, input: flexure, objective: 'available-bars', availableDiametersMm: [16] });
    expect(subset.kind).toBe('alternatives');
    if (subset.kind === 'alternatives') for (const candidate of subset.candidates) expect(candidate.reinforcement.group.diameterMm).toBe(16);
    const empty = reinforcementAlternatives({ kind: 'flexure', requestId: 3, input: flexure, objective: 'available-bars', availableDiametersMm: [] });
    expect(empty).toMatchObject({ kind: 'alternatives', candidates: [], reason: 'empty-stock' });
  });

  it('removes duplicate reinforcement optima', () => {
    const response = reinforcementAlternatives({ kind: 'flexure', requestId: 4, input: flexure, objective: 'few-diameters' });
    expect(response.kind).toBe('alternatives');
    if (response.kind === 'alternatives') {
      const keys = response.candidates.map((candidate) => `${candidate.reinforcement.group.count}:${candidate.reinforcement.group.diameterMm}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('checks column alternatives with the column engine and retains captured dimensions and actions', () => {
    const response = reinforcementAlternatives({ kind: 'column', requestId: 5, input: column, objective: 'available-bars', availableDiametersMm: [19.1] });
    expect(response.kind).toBe('alternatives');
    if (response.kind !== 'alternatives') return;
    expect(response.candidates.length).toBeLessThanOrEqual(3);
    for (const candidate of response.candidates) {
      expect(candidate.geometry).toEqual({ widthMm: 400, heightMm: 400 });
      const checked = designColumn({ ...column, ...candidate.applyFields, barDiameterMm: Number(candidate.applyFields?.bar), barsAlongWidth: Number(candidate.applyFields?.barsWidth), barsAlongDepth: Number(candidate.applyFields?.barsDepth) });
      expect(checked.ok && checked.status !== 'fail').toBe(true);
      expect(candidate.reinforcement.group.diameterMm).toBe(19.1);
    }
  });

  it('keeps experimental section candidates labeled and constrained to evaluated checks', () => {
    const response = reinforcementAlternatives({ kind: 'section', requestId: 6, input: section, objective: 'available-bars', availableDiametersMm: [20] });
    expect(response.kind).toBe('alternatives');
    if (response.kind !== 'alternatives') return;
    for (const candidate of response.candidates) {
      expect(candidate.display).toContain('Experimental');
      expect(candidate.checked.checks.every((check) => check.status === 'pass')).toBe(true);
      expect(candidate.checked.excluded.length).toBeGreaterThan(0);
    }
  });
});
