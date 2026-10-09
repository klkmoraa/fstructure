// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { designCode } from '../../../design/elements/codes';
import { designFrame, type FrameDesignInput } from '../../../design/elements/frame';
import { FrameElevation, ratioBand } from './FrameDrawings';

afterEach(cleanup);

const input: FrameDesignInput = {
  code: 'ntc-2023', bays: [5], stories: [{ heightM: 3.5, deadKnPerM: 1, liveKnPerM: 0, lateralKn: 0 }],
  base: 'fixed', braced: false, beam: { widthMm: 300, heightMm: 550 }, column: { widthMm: 800, heightMm: 800 },
  coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420, maxAggregateMm: 19, includeSelfWeight: true,
  combinations: designCode('ntc-2023').loadCombinations('B'),
  lateralCombinations: designCode('ntc-2023').lateralCombinations('B').combinations,
  lateralReference: designCode('ntc-2023').lateralCombinations('B').reference,
  sustainedLiveRatio: 0.4, longTermXi: 2, damagesNonstructural: false, beamBarDiameterMm: null, stirrupDiameterMm: 6.4,
  columnReinforcement: { barDiameterMm: 19.1, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5 },
  group: 'B2', beamInertiaFactor: 1, columnInertiaFactor: 1, effectiveLengthFactor: null,
};

describe('FrameElevation pendiente de revisión', () => {
  it('marca el cociente sin aprobar una viga cuya aceptación transversal no se verificó', () => {
    const result = designFrame(input);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const beam = result.beams[0]!;
    const member = result.members.find((item) => item.designId === beam.id)!;
    expect(beam.result.status).toBe('warning');
    expect(member.status).toBe('warning');
    expect(ratioBand(member.ratio, member.status)).toBe('review');
    expect(ratioBand(1.01, 'warning')).toBe('fail');
    expect(ratioBand(Number.NaN, 'fail')).toBe('fail');

    const { container } = render(<FrameElevation result={result} kind="ratio" />);
    expect(container.querySelector('.dw-frame__member[data-band="review"]')).toBeTruthy();
    const label = container.querySelector('.dw-frame__ratios text[data-band="review"]')!;
    expect(label.textContent).toContain('*');
    expect(label.getAttribute('aria-label')).toContain('revisión pendiente');
    expect(screen.getByRole('img', { name: /Utilización de el pórtico/ })).toBeTruthy();
  });
});
