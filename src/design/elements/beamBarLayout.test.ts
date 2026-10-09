import { describe, expect, it } from 'vitest';
import { barArea } from './shared';
import { layoutBeamBed } from './beamBarLayout';

const geometry = {
  widthMm: 300,
  heightMm: 600,
  coverMm: 40,
  stirrupDiameterMm: 9.5,
  minimumClearSpacingMm: 28.5,
};

describe('layoutBeamBed', () => {
  it('distributes six continuous bars over two layers without changing their identity', () => {
    const bars = layoutBeamBed({ ...geometry, continuous: { count: 6, diameterMm: 19.1 }, extra: null });
    if (!bars) throw new Error('Expected a feasible two-layer layout.');

    expect(bars).toHaveLength(6);
    expect(bars.every((bar) => bar.kind === 'continuous' && bar.diameterMm === 19.1)).toBe(true);
    expect(bars.filter((bar) => bar.layer === 1)).toHaveLength(4);
    expect(bars.filter((bar) => bar.layer === 2)).toHaveLength(2);
    expect(bars.slice(0, 4).every((bar) => bar.fromFaceMm === 40 + 9.5 + 19.1 / 2)).toBe(true);
    expect(bars.slice(4).every((bar) => bar.fromFaceMm === 40 + 9.5 + 19.1 / 2 + 44.1)).toBe(true);
    for (const layer of [1, 2] as const) {
      const row = bars.filter((bar) => bar.layer === layer);
      expect(row.slice(1).every((bar, index) => bar.xMm - row[index]!.xMm - (bar.diameterMm + row[index]!.diameterMm) / 2 >= 28.5)).toBe(true);
    }
    const weightedCentroid = bars.reduce((sum, bar) => sum + barArea(bar.diameterMm) * bar.fromFaceMm, 0)
      / bars.reduce((sum, bar) => sum + barArea(bar.diameterMm), 0);
    expect(weightedCentroid).toBeCloseTo((4 * (40 + 9.5 + 19.1 / 2) + 2 * (40 + 9.5 + 19.1 / 2 + 44.1)) / 6, 8);
  });

  it('preserves mixed diameters and places the automatically selected two continuous bars', () => {
    const bars = layoutBeamBed({ ...geometry, continuous: { count: 2, diameterMm: 15.9 }, extra: { count: 2, diameterMm: 22.2 } });
    if (!bars) throw new Error('Expected a feasible mixed-diameter layout.');

    expect(bars).toHaveLength(4);
    expect(bars.filter((bar) => bar.kind === 'continuous').map((bar) => bar.diameterMm)).toEqual([15.9, 15.9]);
    expect(bars.filter((bar) => bar.kind === 'extra').map((bar) => bar.diameterMm)).toEqual([22.2, 22.2]);
    const continuousXs = bars.filter((bar) => bar.kind === 'continuous').map((bar) => bar.xMm);
    const firstLayerXs = bars.filter((bar) => bar.layer === 1).map((bar) => bar.xMm);
    expect(continuousXs).toEqual([firstLayerXs[0], firstLayerXs.at(-1)]);

    const oneExtraInSecond = layoutBeamBed({ ...geometry, continuous: { count: 2, diameterMm: 15.9 }, extra: { count: 3, diameterMm: 22.2 } });
    if (!oneExtraInSecond) throw new Error('Expected a feasible two-layer mixed-diameter layout.');
    expect(oneExtraInSecond.filter((bar) => bar.layer === 2)).toHaveLength(1);
    expect(oneExtraInSecond.find((bar) => bar.layer === 2)!.xMm).toBe(geometry.widthMm / 2);

    const automatic = layoutBeamBed({ ...geometry, continuous: { count: 2, diameterMm: 15.9 }, extra: null });
    expect(automatic).toHaveLength(2);
    expect(automatic!.every((bar) => bar.kind === 'continuous' && bar.diameterMm === 15.9 && bar.layer === 1)).toBe(true);
  });

  it('returns no layout when two layers cannot meet minimum clear spacing', () => {
    expect(layoutBeamBed({ ...geometry, widthMm: 100, continuous: { count: 6, diameterMm: 31.8 }, extra: null })).toBeNull();
  });
});
