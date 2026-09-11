import { describe, expect, it } from 'vitest';
import {
  applySupportPreset,
  entriesOfFamily,
  findSupportEntry,
  isSpringEntryActive,
  matchSupportEntry,
} from './supportCatalog';

describe('supportCatalog presets & switching', () => {
  it('applies an elastic preset from a free node with default positive stiffness', () => {
    const springY = findSupportEntry('spring-y')!;
    expect(springY).toBeDefined();

    const result = applySupportPreset({ type: 'none' }, springY);
    expect(result).toEqual({
      type: 'none',
      spring: { ky: 1000 },
    });
  });

  it('replaces a basic support (pin) with an elastic support', () => {
    const springX = findSupportEntry('spring-x')!;
    const result = applySupportPreset({ type: 'pin' }, springX);

    expect(result).toEqual({
      type: 'none',
      spring: { kx: 1000 },
    });
  });

  it('replaces a fixed support with combined springs', () => {
    const springCombined = findSupportEntry('spring-combined')!;
    const result = applySupportPreset({ type: 'fixed' }, springCombined);

    expect(result).toEqual({
      type: 'none',
      spring: { kx: 1000, ky: 1000, kr: 1000, kNormal: 1000, angleDeg: 90 },
    });
  });

  it('clears spring when changing from a standalone elastic support to a basic pin support', () => {
    const pin = findSupportEntry('pin')!;
    const result = applySupportPreset({ type: 'none', spring: { ky: 1000 } }, pin);

    expect(result).toEqual({
      type: 'pin',
      spring: undefined,
    });
  });

  it('clears spring when changing from a standalone elastic support to free', () => {
    const free = findSupportEntry('free')!;
    const result = applySupportPreset({ type: 'none', spring: { ky: 1000 } }, free);

    expect(result).toEqual({
      type: 'none',
    });
  });

  it('switches between elastic support presets cleanly', () => {
    const springX = findSupportEntry('spring-x')!;
    const current = { type: 'none' as const, spring: { ky: 500 } };
    const result = applySupportPreset(current, springX);

    expect(result).toEqual({
      type: 'none',
      spring: { kx: 1000 },
    });
  });

  it('matches elastic entries when node has standalone springs', () => {
    const entryY = matchSupportEntry({ type: 'none', spring: { ky: 1000 } });
    expect(entryY.id).toBe('spring-y');
    expect(entryY.family).toBe('elastic');

    const entryCombined = matchSupportEntry({ type: 'none', spring: { kx: 1000, ky: 1000 } });
    expect(entryCombined.id).toBe('spring-combined');
    expect(entryCombined.family).toBe('elastic');

    const entryFree = matchSupportEntry({ type: 'none' });
    expect(entryFree.id).toBe('free');
    expect(entryFree.family).toBe('basic');
  });

  it('determines active spring entries correctly', () => {
    const springY = findSupportEntry('spring-y')!;
    const springX = findSupportEntry('spring-x')!;
    const springCombined = findSupportEntry('spring-combined')!;

    const singleState = { type: 'none' as const, spring: { ky: 1000 } };
    expect(isSpringEntryActive(singleState, springY)).toBe(true);
    expect(isSpringEntryActive(singleState, springX)).toBe(false);
    expect(isSpringEntryActive(singleState, springCombined)).toBe(false);

    const combinedState = { type: 'none' as const, spring: { kx: 1000, ky: 1000 } };
    expect(isSpringEntryActive(combinedState, springCombined)).toBe(true);
    expect(isSpringEntryActive(combinedState, springY)).toBe(false);
  });

  it('exposes advanced entries as interactive advanced kind', () => {
    const advancedEntries = entriesOfFamily('advanced');
    expect(advancedEntries.length).toBe(5);
    const nonSettlement = advancedEntries.filter((e) => e.id !== 'settlement');
    for (const entry of nonSettlement) {
      expect(entry.kind).toBe('advanced');
      expect((entry as any).unavailableKey).toBeUndefined();
    }
  });
});
