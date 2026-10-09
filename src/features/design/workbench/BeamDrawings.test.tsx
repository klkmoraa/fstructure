// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { designBeam, type BeamDesignInput } from '../../../design/elements/beam';
import { designCode } from '../../../design/elements/codes';
import { BeamElevation, BeamSection } from './BeamDrawings';

afterEach(cleanup);

const input: BeamDesignInput = {
  code: 'ntc-2023', widthMm: 300, heightMm: 600, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420,
  spans: [{ lengthM: 4, deadKnPerM: 10, liveKnPerM: 0, pointDeadKn: 0, pointLiveKn: 0, pointAtM: 2 }],
  leftEnd: 'roller', rightEnd: 'pin', includeSelfWeight: false,
  combinations: designCode('ntc-2023').loadCombinations('B'), sustainedLiveRatio: 0, longTermXi: 2,
  barDiameterMm: null, stirrupDiameterMm: null, maxAggregateMm: 19, damagesNonstructural: false, supportWidthMm: 400,
};

describe('BeamElevation supports', () => {
  it('draws the explicit roller and the pin that stabilizes X in the solver', () => {
    const result = designBeam(input);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { container } = render(<BeamElevation result={result} />);
    const supports = container.querySelectorAll('.dw-support');
    expect(supports).toHaveLength(2);
    expect(supports[0]!.querySelector('line:not(.dw-support__hatch)')).toBeTruthy();
    expect(supports[0]!.querySelector('.dw-support__hatch')).toBeNull();
    expect(supports[1]!.querySelector('.dw-support__hatch')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Elevación de la viga/ })).toBeTruthy();
  });

  it('draws a fixed wall and an explicit roller for an empotrada–apoyada beam', () => {
    const result = designBeam({ ...input, leftEnd: 'fixed', rightEnd: 'roller' });
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { container } = render(<BeamElevation result={result} />);
    const supports = container.querySelectorAll('.dw-support');
    expect(supports).toHaveLength(2);
    expect(supports[0]!.querySelectorAll('line')).toHaveLength(6);
    expect(supports[0]!.querySelector('path')).toBeNull();
    expect(supports[1]!.querySelector('path')).toBeTruthy();
    expect(supports[1]!.querySelector('line:not(.dw-support__hatch)')).toBeTruthy();
  });
});

describe('BeamSection bar distribution', () => {
  it('draws six real continuous bars on two layers without throwing', () => {
    const result = designBeam({
      ...input,
      provided: {
        top: { count: 6, diameterMm: 19.1 },
        bottom: { count: 6, diameterMm: 19.1 },
        bastions: 'none',
        stirrupSpacingMm: null,
      },
    });
    if (!result.ok) throw new Error(result.errors.join('\n'));

    const { container } = render(<BeamSection result={result} cut={result.cuts[0]!} />);
    const bars = container.querySelectorAll('.dw-bar:not(.dw-bar--extra)');
    expect(bars).toHaveLength(12);
    const topLayerYs = new Set(Array.from(bars).slice(0, 6).map((bar) => bar.getAttribute('cy')));
    expect(topLayerYs.size).toBe(2);
    const firstLayerCentroid = input.coverMm + result.stirrupDiameterMm + 19.1 / 2;
    const secondLayerCentroid = firstLayerCentroid + 19.1 + 25;
    const expectedBottomDepth = input.heightMm - (4 * firstLayerCentroid + 2 * secondLayerCentroid) / 6;
    expect(result.continuousBottom.effectiveDepthMm).toBeCloseTo(expectedBottomDepth, 8);
  });
});
