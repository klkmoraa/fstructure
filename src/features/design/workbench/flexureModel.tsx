import type { ReactElement } from 'react';
import { designFlexureExercise, type FlexureExerciseInput } from '../../../design/elements/flexureExercise';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { barArea } from '../../../design/elements/shared';
import { formatNumber, mpaFromKgcm2, parseNumber } from './common';
import type { DesignReport } from './designReport';

export const FLEXURE_DEFAULTS = {
  tag: '', place: '', exercise: '', objective: 'required',
  width: '40', height: '60', cover: '4', fc: '255', fy: '4280', stirrup: '9.5', aggregate: '19', moment: '',
  topCount: '2', topBar: '15.9', bottomCount: '6', bottomBar: '15.9',
};
export type FlexureDraft = typeof FLEXURE_DEFAULTS;
export type FlexureObjective = 'required' | 'check' | 'dimensions';

export const flexurePublishedReport = (objective: FlexureObjective, inputKey: string, appliedInputKey: string, hasUnappliedPreview: boolean, report: DesignReport | null): DesignReport | null =>
  objective === 'dimensions' && (hasUnappliedPreview || appliedInputKey !== inputKey) ? null : report;

export const flexureProblemDefaults: FlexureDraft = {
  ...FLEXURE_DEFAULTS, width: '', height: '', cover: '4', fc: '', fy: '', moment: '',
  topCount: '2', topBar: '15.9', bottomCount: '2', bottomBar: '15.9', objective: 'required',
};
export const isFlexureDraftComplete = (draft: FlexureDraft): boolean => {
  const fields = [draft.width, draft.height, draft.cover, draft.fc, draft.fy, draft.stirrup, draft.aggregate, draft.moment, draft.topCount, draft.topBar, draft.bottomCount, draft.bottomBar];
  return fields.every((value) => value.trim() !== '' && Number.isFinite(Number(value)))
    && Number(draft.width) > 0 && Number(draft.height) > 0 && Number(draft.fc) > 0 && Number(draft.fy) > 0
    && Number(draft.cover) >= 0 && Number(draft.stirrup) > 0 && Number(draft.aggregate) >= 0
    && Number(draft.topCount) > 0 && Number(draft.bottomCount) > 0 && Number(draft.topBar) > 0 && Number(draft.bottomBar) > 0;
};

export const flexureToInput = (code: DesignCodeId, draft: FlexureDraft): FlexureExerciseInput => ({
  code, widthMm: parseNumber(draft.width) * 10, heightMm: parseNumber(draft.height) * 10,
  coverMm: parseNumber(draft.cover) * 10, fcMpa: mpaFromKgcm2(draft.fc), fyMpa: mpaFromKgcm2(draft.fy),
  stirrupDiameterMm: parseNumber(draft.stirrup), aggregateMm: parseNumber(draft.aggregate), momentKnM: parseNumber(draft.moment),
  top: { count: parseNumber(draft.topCount), diameterMm: parseNumber(draft.topBar) },
  bottom: { count: parseNumber(draft.bottomCount), diameterMm: parseNumber(draft.bottomBar) },
});

const cm2 = (value: number) => `${formatNumber(value / 100, 2)} cm²`;
const barsText = (count: string, diameter: string) => `${count} Ø${formatNumber(parseNumber(diameter), 1)}`;
const figure = (result: ReturnType<typeof designFlexureExercise>): ReactElement => <svg viewBox="0 0 240 180" role="img" aria-label="Sección rectangular y lecho a tensión">
  <rect x="55" y="20" width="130" height="140" fill="none" stroke="currentColor" strokeWidth="2" />
  <text fill="currentColor" x="120" y="14" textAnchor="middle" fontSize="11">b</text><text fill="currentColor" x="192" y="93" fontSize="11">h</text>
  {(result.layout.bars ?? []).map((bar, index) => <circle key={index} cx={55 + bar.xMm / 4} cy={result.layout.tensionBed === 'bottom' ? 160 - bar.fromFaceMm / 4 : 20 + bar.fromFaceMm / 4} r={Math.max(2, bar.diameterMm / 5)} fill="currentColor" />)}
  <text fill="currentColor" x="120" y="174" textAnchor="middle" fontSize="10">Lecho a tensión: {result.layout.tensionBed === 'bottom' ? 'inferior' : 'superior'}</text>
</svg>;

export function flexureReport(codeId: DesignCodeId, draft: FlexureDraft): DesignReport {
  if (!isFlexureDraftComplete(draft)) throw new Error('Completa el momento, la sección y los materiales antes de generar el reporte.');
  const input = flexureToInput(codeId, draft);
  const result = designFlexureExercise(input);
  const code = designCode(codeId);
  const objective = draft.objective as FlexureObjective;
  const checking = objective !== 'required';
  const tensionGroup = result.layout.tensionBed === 'top' ? draft.topCount : draft.bottomCount;
  const tensionBar = result.layout.tensionBed === 'top' ? draft.topBar : draft.bottomBar;
  const compressionGroup = result.layout.tensionBed === 'top' ? draft.bottomCount : draft.topCount;
  const compressionBar = result.layout.tensionBed === 'top' ? draft.bottomBar : draft.topBar;
  const equation = `As req: φ·As·${formatNumber(input.fyMpa)}·(${formatNumber(result.effectiveDepthMm, 1)} − a/2) = ${formatNumber(Math.abs(input.momentKnM))} kN·m; a = As·${formatNumber(input.fyMpa)}/(0.85·${formatNumber(input.fcMpa)}·${formatNumber(input.widthMm)}). As requerida ${formatNumber(result.requiredMm2, 2)} mm² (${formatNumber(result.requiredMm2 / 100, 2)} cm²).`;
  const outOfScope = result.checks.filter((check) => check.status === 'out-of-scope');
  const checks = checking ? result.checks.filter((check) => !['out-of-scope', 'info', 'warning'].includes(check.status)) : [];
  const reportStatus = checking ? result.status : 'warning';
  const notes = result.checks.filter((check) => ['info', 'warning'].includes(check.status));
  return {
    element: 'flexure', title: `Sección ${formatNumber(input.widthMm / 10, 0)} × ${formatNumber(input.heightMm / 10, 0)} cm`, tag: draft.tag, place: draft.place,
    code: codeId, status: reportStatus, governingRatio: checking && result.capacityKnM ? Math.abs(input.momentKnM) / result.capacityKnM : 0,
    memo: [
      `FLEXIÓN SIMPLE · ${code.name} · Mu = ${formatNumber(input.momentKnM)} kN·m`,
      `Sección rectangular: b = ${formatNumber(input.widthMm)} mm · h = ${formatNumber(input.heightMm)} mm · recubrimiento libre = ${formatNumber(input.coverMm)} mm.`,
      checking
        ? `Lecho a tensión: ${result.layout.tensionBed === 'top' ? 'superior' : 'inferior'} · As req = ${formatNumber(result.requiredMm2, 2)} mm² · As mín = ${formatNumber(result.minimumMm2, 2)} mm² · As prov = ${formatNumber(result.providedMm2, 2)} mm² · d = ${formatNumber(result.effectiveDepthMm, 1)} mm · φMn = ${formatNumber(result.capacityKnM)} kN·m.`
        : `Lecho a tensión: ${result.layout.tensionBed === 'top' ? 'superior' : 'inferior'} · As req = ${formatNumber(result.requiredMm2, 2)} mm² · As mín = ${formatNumber(result.minimumMm2, 2)} mm² · d de referencia = ${formatNumber(result.effectiveDepthMm, 1)} mm. El armado aún no se revisa.`,
      equation,
      ...outOfScope.map((check) => `Sin evaluar: ${check.label}. ${check.note ?? ''}`),
      'FStructure · Diseño experimental; requiere revisión profesional.',
    ].join('\n'),
    checks, notes, outOfScope, input,
    data: [
      { title: 'Acción dada', rows: [{ label: 'Mu', value: `${formatNumber(input.momentKnM)} kN·m` }, { label: 'Objetivo', value: ({ required: 'Acero requerido', check: 'Revisar armado propio', dimensions: 'Dimensionar por flexión' } as const)[draft.objective as FlexureObjective] }] },
      { title: 'Geometría y materiales', rows: [
        { label: 'Sección', value: `Rectangular · b ${formatNumber(input.widthMm)} × h ${formatNumber(input.heightMm)} mm` },
        { label: 'Recubrimiento / estribo / agregado', value: `${formatNumber(input.coverMm)} / ${formatNumber(input.stirrupDiameterMm)} / ${formatNumber(input.aggregateMm)} mm` },
        { label: 'f′c / fy', value: `${draft.fc} kg/cm² (${formatNumber(input.fcMpa)} MPa) / ${draft.fy} kg/cm² (${formatNumber(input.fyMpa)} MPa)` },
        { label: 'Barras de referencia · cara opuesta', value: `${barsText(compressionGroup, compressionBar)} (no se cuentan en la resistencia)` },
      ] },
    ],
    reinforcement: [{ label: checking ? `Armado propio · lecho ${result.layout.tensionBed === 'top' ? 'superior' : 'inferior'}` : `Armado de referencia · lecho ${result.layout.tensionBed === 'top' ? 'superior' : 'inferior'}`, value: checking ? `${barsText(tensionGroup, tensionBar)} · As ${cm2(result.providedMm2)}` : `${barsText(tensionGroup, tensionBar)} · sólo estima d; no se considera dado` }],
    values: [
      { symbol: 'Mu', label: 'Momento dado', value: `${formatNumber(input.momentKnM)} kN·m` },
      { symbol: 'As req', label: equation, value: cm2(result.requiredMm2) },
      { symbol: 'As mín', label: 'Cuantía mínima del perfil', value: cm2(result.minimumMm2) },
      ...(checking ? [{ symbol: 'As prov', label: 'Área discreta del lecho a tensión', value: cm2(result.providedMm2) }] : []),
      { symbol: 'd', label: checking ? 'Peralte efectivo al centroide del acero extremo' : 'Peralte efectivo estimado con armado de referencia', value: `${formatNumber(result.effectiveDepthMm, 1)} mm` },
      ...(checking ? [{ symbol: 'φMn', label: 'Resistencia del armado proporcionado', value: `${formatNumber(result.capacityKnM)} kN·m` }] : []),
    ], tables: [], takeoff: { lines: [], steelKg: 0, concreteM3: 0, steelRatioKgM3: 0, basis: 'No se cuantifica: falta longitud de la pieza.' },
    figures: [{ title: 'Sección y lecho a tensión', note: 'Esquema; dimensiones en mm. Sólo se contabiliza el acero del lecho a tensión.', render: () => figure(result) }],
  };
}

export const flexureDisplayArea = (count: string, diameter: string) => parseNumber(count) * barArea(parseNumber(diameter));
