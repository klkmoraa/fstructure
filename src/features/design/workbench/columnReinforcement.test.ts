import { describe, expect, it } from 'vitest';
import { designColumn } from '../../../design/elements/column';
import { COLUMN_DEFAULTS, columnToInput, proposeColumnReinforcement } from './columnModel';

describe('proposeColumnReinforcement', () => {
  it('proposes longitudinal steel for the captured 40 × 50 cm rectangular section', () => {
    const draft = { ...COLUMN_DEFAULTS, width: '40', depth: '50' };
    const proposal = proposeColumnReinforcement('ntc-2023', draft);

    expect(proposal).not.toBeNull();
    expect(proposal).not.toHaveProperty('width');
    expect(proposal).not.toHaveProperty('depth');
    const result = designColumn(columnToInput('ntc-2023', { ...draft, ...proposal }));
    expect(result.ok && result.status).not.toBe('fail');
    if (result.ok) expect(result.input).toMatchObject({ widthMm: 400, depthMm: 500 });
  });

  it('proposes longitudinal steel for the captured circular Ø45 cm section', () => {
    const draft = { ...COLUMN_DEFAULTS, shape: 'circular', diameter: '45' };
    const proposal = proposeColumnReinforcement('ntc-2023', draft);

    expect(proposal).not.toBeNull();
    expect(proposal).not.toHaveProperty('diameter');
    const result = designColumn(columnToInput('ntc-2023', { ...draft, ...proposal }));
    expect(result.ok && result.status).not.toBe('fail');
    if (result.ok) expect(result.input).toMatchObject({ widthMm: 450, depthMm: 450 });
  });

  it('keeps explicit zero actions, materials and dimensions unchanged', () => {
    const draft = { ...COLUMN_DEFAULTS, width: '40', depth: '50', axial: '0', momentX: '0', momentY: '0', shearX: '0', shearY: '0', fc: '300', fy: '5000' };
    const proposal = proposeColumnReinforcement('ntc-2023', draft);

    expect(proposal).not.toBeNull();
    expect(proposal).not.toHaveProperty('width');
    expect(proposal).not.toHaveProperty('depth');
    expect(proposal).not.toHaveProperty('fc');
    expect(proposal).not.toHaveProperty('fy');
    const result = designColumn(columnToInput('ntc-2023', { ...draft, ...proposal }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input).toMatchObject({ widthMm: 400, depthMm: 500, axialKn: 0, momentXKnm: 0, momentYKnm: 0, shearXKn: 0, shearYKn: 0 });
  });

  it('rejects non-finite actions and an impossible captured section', () => {
    expect(proposeColumnReinforcement('ntc-2023', { ...COLUMN_DEFAULTS, axial: 'Infinity' })).toBeNull();
    expect(proposeColumnReinforcement('ntc-2023', { ...COLUMN_DEFAULTS, width: '1', depth: '1' })).toBeNull();
  });
});
