/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { designCode, type DesignCodeId } from './codes';
import { designColumn, type ColumnDesignInput } from './column';
import { designFooting, type FootingDesignInput } from './footing';
import { flexuralCapacity, requiredFlexuralSteelMm2 } from './shared';

/**
 * Contraste entre lenguajes: `validation/python/elements_oracle.py` resuelve los
 * mismos casos con algoritmos distintos (bisección sobre el eje neutro,
 * integración numérica de presiones, malla fina de acero) y fija estos fixtures
 * para la NTC-CDMX 2023, la NSR-10 y la E.060.
 */
const FIXTURES = join(process.cwd(), 'validation/fixtures/elements');
const files = readdirSync(FIXTURES).filter((name) => name.endsWith('.json')).sort();
const load = <T,>(name: string): T => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T;
const close = (actual: number, expected: number, relative: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relative * Math.max(1, Math.abs(expected)));

describe('design workbench cross-language fixtures', () => {
  it('covers the three codes', () => {
    const codes = new Set(files.filter((name) => /^(column|footing)-/.test(name)).map((name) => load<{ input: { code: DesignCodeId } }>(name).input.code));
    expect([...codes].sort()).toEqual(['e060', 'nsr-10', 'ntc-2023']);
  });

  it.each(files.filter((name) => name.startsWith('column-')))('column %s: minimum moment, magnification and Bresler', (name) => {
    const fixture = load<{ input: ColumnDesignInput; expected: Record<string, number> }>(name);
    const result = designColumn(fixture.input);
    if (!result.ok) throw new Error(result.errors.join(' '));
    close(result.magnification.x.designMomentKnm, fixture.expected.designMomentXKnm!, 1e-9);
    close(result.magnification.y.designMomentKnm, fixture.expected.designMomentYKnm!, 1e-9);
    close(result.maximumDesignAxialKn, fixture.expected.maximumDesignAxialKn!, 1e-9);
    expect(result.capacity.method).toBe('bresler-load');
    // El motor interseca una curva muestreada; el oráculo resuelve el eje neutro exacto.
    close(result.capacity.ratio, fixture.expected.ratio!, 5e-3);
  });

  it.each(files.filter((name) => name.startsWith('footing-')))('footing %s: pressures, shears, punching and anchorage', (name) => {
    const fixture = load<{ input: FootingDesignInput; expected: Record<string, Record<string, number>> }>(name);
    const result = designFooting(fixture.input);
    if (!result.ok) throw new Error(result.errors.join(' '));
    for (const axis of ['x', 'y'] as const) {
      const actual = result.directions[axis];
      const expected = fixture.expected[axis]!;
      close(actual.effectiveDepthMm, expected.effectiveDepthMm!, 1e-12);
      close(actual.momentKnm, expected.momentKnm!, 1e-6);
      expect(actual.barCount).toBe(expected.barCount);
      close(actual.providedMm2, expected.providedMm2!, 1e-12);
      close(actual.strengthKnm, expected.strengthKnm!, 1e-9);
      close(actual.oneWayDemandKn, expected.oneWayDemandKn!, 1e-6);
      close(actual.oneWayStrengthKn, expected.oneWayStrengthKn!, 1e-9);
      close(actual.developmentLengthMm, expected.developmentLengthMm!, 1e-9);
      close(actual.hookLengthMm, expected.hookLengthMm!, 1e-9);
    }
    close(result.punching.demandKn, fixture.expected.punching!.demandKn!, 1e-9);
    close(result.punching.demandStressMpa, fixture.expected.punching!.demandStressMpa!, 1e-9);
    close(result.punching.strengthStressMpa, fixture.expected.punching!.strengthStressMpa!, 1e-9);
  });

  it.each(files.filter((name) => name.endsWith('blocks.json')))('%s: φ, required steel, development and hooks', (name) => {
    const fixture = load<{
      flexure: { code?: DesignCodeId; areaMm2: number; widthMm: number; depthMm: number; fyMpa: number; fcMpa: number; strengthKnm: number }[];
      required: { code?: DesignCodeId; momentKnm: number; widthMm: number; depthMm: number; fyMpa: number; fcMpa: number; areaMm2: number | null }[];
      development: { code?: DesignCodeId; diameterMm: number; fyMpa: number; fcMpa: number; topBar: boolean; clearSpacingMm: number; clearCoverMm: number; minimumStirrups: boolean; lengthMm: number }[];
      hooks?: { diameterMm: number; fyMpa: number; fcMpa: number; lengthMm: number }[];
    }>(name);
    for (const item of fixture.flexure) {
      const code = designCode(item.code ?? 'ntc-2023');
      close(flexuralCapacity(item.areaMm2, item.widthMm, item.depthMm, item.fyMpa, item.fcMpa, item.depthMm, code.flexureFactor).strengthKnm, item.strengthKnm, 1e-9);
    }
    for (const item of fixture.required) {
      const code = designCode(item.code ?? 'ntc-2023');
      const area = requiredFlexuralSteelMm2(item.momentKnm, item.widthMm, item.depthMm, item.fyMpa, item.fcMpa, item.depthMm, code.flexureFactor, code.tensionControlledStrain);
      // null: ninguna cuantía hasta la balanceada alcanza la demanda en ninguno de los dos cálculos.
      if (item.areaMm2 === null) expect(area).toBeUndefined();
      else close(area!, item.areaMm2, 1e-6);
    }
    for (const item of fixture.development) {
      close(designCode(item.code ?? 'ntc-2023').developmentLength(item).lengthMm, item.lengthMm, 1e-12);
    }
    for (const item of fixture.hooks ?? []) {
      for (const code of ['ntc-2023', 'nsr-10', 'e060'] as const) {
        close(designCode(code).hookedDevelopmentMm(item.diameterMm, item.fyMpa, item.fcMpa), item.lengthMm, 1e-12);
      }
    }
  });
});
