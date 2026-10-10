import { describe, expect, it } from 'vitest';
import { DESIGN_STARTS } from './designStarts';
import { proposeFlexureDimensions } from '../../../design/elements/flexureExercise';
import { flexurePublishedReport, flexureReport, FLEXURE_DEFAULTS, isFlexureDraftComplete } from './flexureModel';
import { memoText, snapshotHash } from './designReport';
import { reportFromMemoryItem } from './designMemory';

describe('borrador y reporte de flexión', () => {
  it('conserva Mu vacío como incompleto y distingue Mu explícito igual a cero', () => {
    expect(isFlexureDraftComplete({ ...FLEXURE_DEFAULTS, moment: '' })).toBe(false);
    expect(isFlexureDraftComplete({ ...FLEXURE_DEFAULTS, moment: '0' })).toBe(true);
    const report = flexureReport('ntc-2023', { ...FLEXURE_DEFAULTS, moment: '0' });
    expect(report.memo).toContain('Mu = 0.0 kN·m');
  });

  it('oculta del reporte vigente cualquier preview de dimensiones sin aplicar', () => {
    const current = flexureReport('ntc-2023', { ...FLEXURE_DEFAULTS, moment: '200', objective: 'check' });
    expect(flexurePublishedReport('dimensions', 'new-input', 'old-input', true, current)).toBeNull();
    expect(flexurePublishedReport('dimensions', 'new-input', 'old-input', false, current)).toBeNull();
    expect(flexurePublishedReport('dimensions', 'same-input', 'same-input', false, current)).toBe(current);
  });

  it('dimensiona un ejercicio sin base ni peralte capturados', () => {
    const start = DESIGN_STARTS.find((item) => item.id === 'problem-flexure')!;
    const input = { code: 'ntc-2023' as const, widthMm: Number.NaN, heightMm: Number.NaN, coverMm: 40, fcMpa: 25, fyMpa: 420, stirrupDiameterMm: 9.5, aggregateMm: 19, momentKnM: 200, top: { count: 2, diameterMm: 15.9 }, bottom: { count: 6, diameterMm: 15.9 } };
    const proposal = proposeFlexureDimensions(input, { widthMinMm: 200, widthMaxMm: 600, heightMinMm: 250, heightMaxMm: 1500, stepMm: 50 });
    expect(proposal).not.toBeNull();
    expect(proposal!.widthMm).toBeGreaterThanOrEqual(200);
    expect(proposal!.heightMm).toBeGreaterThanOrEqual(250);
    expect(start.fields.width).toBe('');
    expect(start.fields.height).toBe('');
  });

  it('el ejercicio propio empieza con los datos del profesor vacíos y los armados como referencia', () => {
    const start = DESIGN_STARTS.find((item) => item.id === 'problem-flexure')!;
    expect(start.fields).toMatchObject({ moment: '', width: '', height: '', fc: '', fy: '', cover: '4', topCount: '2', bottomCount: '2' });
    expect(reportFromMemoryItem({ id: start.id, element: 'flexure', code: 'ntc-2023', savedAt: '2026-10-10', fields: start.fields }).ok).toBe(false);
  });

  it('registra Mu, unidades, referencias, exclusiones y huella estable en memoria/PDF', async () => {
    const report = flexureReport('ntc-2023', { ...FLEXURE_DEFAULTS, moment: '-200', tag: 'F-1' });
    expect(report.memo).toContain('Mu = -200.0 kN·m');
    expect(report.values.some((value) => value.symbol === 'd' && value.value.endsWith('mm'))).toBe(true);
    expect(report.outOfScope.map((check) => check.label)).toEqual(expect.arrayContaining(['Cortante', 'Desarrollo y anclaje', 'Servicio y deformación', 'Carga axial y flexión biaxial']));
    expect(memoText(report)).toContain('○ Sin evaluar');
    expect(await snapshotHash(report)).toBe(await snapshotHash({ ...report, input: report.input }));
  });
});
