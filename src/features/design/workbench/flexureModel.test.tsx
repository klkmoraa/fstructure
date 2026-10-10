import { describe, expect, it } from 'vitest';
import { DESIGN_STARTS } from './designStarts';
import { proposeFlexureDimensions } from '../../../design/elements/flexureExercise';
import { flexurePublishedReport, flexureReport, FLEXURE_DEFAULTS, isFlexureDraftComplete } from './flexureModel';
import { memoText, snapshotHash } from './designReport';
import { reportFromMemoryItem } from './designMemory';
import { buildDesignMemoriaPdf } from './designReportPdf';
import { designFlexureExercise, type FlexureExerciseInput } from '../../../design/elements/flexureExercise';
import { flexuralCapacity, equivalentBlockStrengthMpa } from '../../../design/elements/shared';
import { designCode } from '../../../design/elements/codes';

describe('borrador y reporte de flexión', () => {
  it('conserva Mu vacío como incompleto y distingue Mu explícito igual a cero', () => {
    expect(isFlexureDraftComplete({ ...FLEXURE_DEFAULTS, moment: '' })).toBe(false);
    expect(isFlexureDraftComplete({ ...FLEXURE_DEFAULTS, moment: '0' })).toBe(true);
    const report = flexureReport('ntc-2023', { ...FLEXURE_DEFAULTS, moment: '0' });
    expect(report.memo).toContain('Mu = 0.0 kN·m');
    const equation = report.values.find((value) => value.symbol === 'As req')!.label;
    expect(equation).toContain('φ = 0.900');
    expect(equation).toContain('As = 0.00 mm²');
    expect(equation).toContain('a = 0.00 mm');
    expect(report.checks).toEqual([]);
    expect(report.notes.filter((note) => note.label.startsWith('Perfil')).length).toBe(3);
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

  it('calcular acero explica el equilibrio con φ, a, conversión de unidades y referencias sin revisar el armado', () => {
    const draft = { ...FLEXURE_DEFAULTS, objective: 'required', moment: '200' };
    const report = flexureReport('ntc-2023', draft);
    const input = report.input as FlexureExerciseInput;
    const result = designFlexureExercise(input);
    const code = designCode('ntc-2023');
    const resistance = flexuralCapacity(result.requiredMm2, input.widthMm, result.effectiveDepthMm, input.fyMpa, input.fcMpa, result.extremeDepthMm, code.flexureFactor);
    const blockDepth = result.requiredMm2 * input.fyMpa / (equivalentBlockStrengthMpa(input.fcMpa) * input.widthMm);
    const equilibrium = resistance.resistanceFactor * result.requiredMm2 * input.fyMpa * (result.effectiveDepthMm - blockDepth / 2) / 1e6;
    const equation = report.values.find((value) => value.symbol === 'As req')!.label;
    expect(equation).toContain('/ 1,000,000');
    expect(equation).toContain(`φ = ${resistance.resistanceFactor.toFixed(3)}`);
    expect(equation).toContain(`a = ${blockDepth.toFixed(2)} mm`);
    expect(equilibrium).toBeCloseTo(200, 4);
    expect(report.checks).toEqual([]);
    const references = report.notes.map((note) => note.reference.label).join(' ');
    expect(references).toContain(code.refs.flexure.label);
    expect(references).toContain(code.refs.steelMin.label);
    expect(references).toContain(code.refs.steelMax.label);
  });

  it('sólo valida y reporta el lecho a tensión; conserva inactivo vacío o inválido', () => {
    const positive = { ...FLEXURE_DEFAULTS, moment: '200', topCount: '', topBar: 'not-a-number' };
    const negative = { ...FLEXURE_DEFAULTS, moment: '-200', bottomCount: '', bottomBar: 'not-a-number' };
    for (const draft of [positive, negative]) {
      expect(isFlexureDraftComplete(draft)).toBe(true);
      const report = flexureReport('ntc-2023', draft);
      expect(report.reinforcement[0]?.value).not.toContain('NaN');
      expect(report.data.flatMap((section) => section.rows).map((row) => row.value).join(' ')).not.toContain('NaN');
    }
    expect(isFlexureDraftComplete({ ...positive, bottomCount: '', bottomBar: '22.2' })).toBe(false);
    expect(isFlexureDraftComplete({ ...negative, topCount: '2', topBar: '' })).toBe(false);
  });

  it.each(['required', 'check', 'dimensions'] as const)('mantiene la validación de un solo lecho para el objetivo %s', (objective) => {
    const positive = { ...FLEXURE_DEFAULTS, objective, moment: '200', topCount: '', topBar: 'invalid' };
    const negative = { ...FLEXURE_DEFAULTS, objective, moment: '-200', bottomCount: '', bottomBar: 'invalid' };
    expect(isFlexureDraftComplete(positive)).toBe(true);
    expect(isFlexureDraftComplete(negative)).toBe(true);
    expect(() => flexureReport('ntc-2023', positive)).not.toThrow();
    expect(() => flexureReport('ntc-2023', negative)).not.toThrow();
    expect(isFlexureDraftComplete({ ...positive, objective: 'dimensions', width: '', height: '' })).toBe(false);
  });

  it('reconstruye memoria y PDF aunque el lecho opuesto tenga datos inválidos', async () => {
    const stored = reportFromMemoryItem({ id: 'flexure-own', element: 'flexure', code: 'ntc-2023', savedAt: '2026-10-10', fields: {
      ...FLEXURE_DEFAULTS, moment: '200', topCount: '', topBar: 'invalid',
    } });
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const bytes = await buildDesignMemoriaPdf([stored.report], { figures: false });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(stored.report.checks).toEqual([]);
    expect(stored.report.notes.some((note) => note.label.startsWith('Perfil aplicado'))).toBe(true);
  });
});
