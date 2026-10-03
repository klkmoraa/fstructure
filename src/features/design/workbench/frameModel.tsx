import { barsText } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import type { ColumnGroup } from '../../../design/elements/column';
import { MAX_FRAME_BAYS, MAX_FRAME_STORIES, designFrame, type FrameDesignInput, type FrameDesignResult } from '../../../design/elements/frame';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { frameTakeoff } from '../../../design/elements/takeoff';
import { BeamElevation, BeamRebarDetail } from './BeamDrawings';
import { InteractionChart } from './ColumnDrawings';
import { LIVE_LOAD_USES, LONG_TERM_DURATIONS, formatNumber, isShortString, mpaFromKgcm2, parseNumber, splitChecks, sustainedRatioFor, xiFor } from './common';
import { stirrupText } from './beamModel';
import type { DesignReport, ReportRow } from './designReport';
import { FrameElevation } from './FrameDrawings';

/**
 * Pórtico: del borrador del formulario a la entrada del motor y a la memoria.
 * Lo usan la mesa y la memoria del proyecto.
 */
export const FRAME_DEFAULTS = {
  tag: '', place: '',
  base: 'fixed', braced: 'no', lateral: 'yes', selfWeight: 'yes',
  beamWidth: '30', beamHeight: '55', columnWidth: '45', columnHeight: '45', cover: '4',
  fc: '250', fy: '4200', fyv: '4200',
  columnBar: '19.1', barsWidth: '3', barsDepth: '3', tie: '9.5',
  group: 'B2', use: 'habitacion', sustained: '25', duration: '60',
  beamBar: 'auto', stirrup: 'auto', aggregate: '19', damages: 'no',
  beamInertia: '1', columnInertia: '1', k: '',
  /** Cargas desde la losa: ancho tributario (m), muerta y viva de la losa (kN/m²) y muros sobre la viga (kN/m). */
  tributary: '4', slabDead: '4.5', slabLive: '1.9', wallLoad: '4',
};
export type FrameDraft = typeof FRAME_DEFAULTS;

export type BayDraft = { length: string };
export type StoryDraft = { height: string; dead: string; live: string; lateral: string };

export const DEFAULT_BAYS: BayDraft[] = [{ length: '5' }, { length: '4' }];
export const DEFAULT_STORIES: StoryDraft[] = [
  { height: '3.5', dead: '22', live: '7.6', lateral: '60' },
  { height: '3', dead: '18', live: '5', lateral: '45' },
];

const rowsOf = <T extends Record<string, string>>(raw: unknown, fields: readonly (keyof T & string)[], max: number): T[] | undefined => {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > max) return undefined;
  const rows = raw.map((item: unknown) => {
    if (!item || typeof item !== 'object') return undefined;
    const record = item as Record<string, unknown>;
    return fields.every((field) => isShortString(record[field])) ? Object.fromEntries(fields.map((field) => [field, record[field]])) as T : undefined;
  });
  return rows.every(Boolean) ? rows as T[] : undefined;
};
export const parseBays = (raw: unknown) => rowsOf<BayDraft>(raw, ['length'], MAX_FRAME_BAYS);
export const parseStories = (raw: unknown) => rowsOf<StoryDraft>(raw, ['height', 'dead', 'live', 'lateral'], MAX_FRAME_STORIES);

const columnGroupOf = (value: string): ColumnGroup => value === 'A' || value === 'B1' ? value : 'B2';
/** Grupo de la construcción: A con los factores del Grupo A; B1 y B2 con los del B. */
const loadGroupOf = (value: string) => value === 'A' ? 'A' as const : 'B' as const;

export function frameToInput(codeId: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]): FrameDesignInput {
  const code = designCode(codeId);
  const group = loadGroupOf(draft.group);
  const lateral = code.lateralCombinations(group);
  const withLateral = draft.lateral === 'yes' && draft.braced !== 'yes';
  const optional = (value: string) => value.trim() === '' ? null : parseNumber(value);
  return {
    code: codeId,
    bays: bays.map((bay) => parseNumber(bay.length)),
    stories: stories.map((story) => ({
      heightM: parseNumber(story.height),
      deadKnPerM: parseNumber(story.dead),
      liveKnPerM: parseNumber(story.live),
      lateralKn: withLateral ? parseNumber(story.lateral) : 0,
    })),
    base: draft.base === 'pinned' ? 'pinned' : 'fixed',
    braced: draft.braced === 'yes',
    beam: { widthMm: parseNumber(draft.beamWidth) * 10, heightMm: parseNumber(draft.beamHeight) * 10 },
    column: { widthMm: parseNumber(draft.columnWidth) * 10, heightMm: parseNumber(draft.columnHeight) * 10 },
    coverMm: parseNumber(draft.cover) * 10,
    fcMpa: mpaFromKgcm2(draft.fc),
    fyMpa: mpaFromKgcm2(draft.fy),
    fyStirrupMpa: mpaFromKgcm2(draft.fyv),
    maxAggregateMm: parseNumber(draft.aggregate),
    includeSelfWeight: draft.selfWeight === 'yes',
    combinations: code.loadCombinations(group),
    lateralCombinations: lateral.combinations,
    lateralReference: lateral.reference,
    sustainedLiveRatio: code.sustainedLive === 'use' ? sustainedRatioFor(draft.use) : parseNumber(draft.sustained) / 100,
    longTermXi: xiFor(draft.duration),
    damagesNonstructural: draft.damages === 'yes',
    beamBarDiameterMm: draft.beamBar === 'auto' ? null : parseNumber(draft.beamBar),
    stirrupDiameterMm: draft.stirrup === 'auto' ? null : parseNumber(draft.stirrup),
    columnReinforcement: {
      barDiameterMm: parseNumber(draft.columnBar),
      barsAlongWidth: parseNumber(draft.barsWidth),
      barsAlongDepth: parseNumber(draft.barsDepth),
      tieDiameterMm: parseNumber(draft.tie),
    },
    group: columnGroupOf(draft.group),
    beamInertiaFactor: parseNumber(draft.beamInertia),
    columnInertiaFactor: parseNumber(draft.columnInertia),
    effectiveLengthFactor: optional(draft.k),
  };
}

const cm = (mm: number) => `${formatNumber(mm / 10, 0)} cm`;
const kgcm2 = (value: string) => `${value} kg/cm² (${formatNumber(mpaFromKgcm2(value), 1)} MPa)`;
const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const describeFrame = (input: FrameDesignInput) =>
  `${plural(input.bays.length, 'claro', 'claros')} × ${plural(input.stories.length, 'nivel', 'niveles')}${input.braced ? ' · arriostrado' : ''}`;

const frameTitle = (input: FrameDesignInput) =>
  `Pórtico ${describeFrame(input)} · V ${formatNumber(input.beam.widthMm / 10, 0)}×${formatNumber(input.beam.heightMm / 10, 0)} · C ${formatNumber(input.column.widthMm / 10, 0)}×${formatNumber(input.column.heightMm / 10, 0)}`;

const columnBarsText = (result: FrameDesignResult) => {
  const { columnReinforcement: bars } = result.input;
  const count = 2 * bars.barsAlongWidth + 2 * Math.max(0, bars.barsAlongDepth - 2);
  return `${count} ${rebarLabel(bars.barDiameterMm)}`;
};

/** Armado por miembro como renglones (panel y memoria). */
function frameReinforcementRows(result: FrameDesignResult): ReportRow[] {
  return [
    ...[...result.beams].reverse().map((beam) => ({
      label: `Viga nivel ${beam.story + 1}`,
      value: [
        `${barsText(beam.result.continuousTop.continuous)} arriba · ${barsText(beam.result.continuousBottom.continuous)} abajo`,
        ...(beam.result.bastions.length ? [`${beam.result.bastions.length} bastones`] : []),
        ...beam.result.spans.map((span, index) => `claro ${index + 1}: ${stirrupText(span.stirrups, beam.result.stirrupDiameterMm)}`),
      ].join(' · '),
    })),
    ...[...new Set(result.columns.map((column) => column.story))].reverse().map((story) => {
      const columns = result.columns.filter((column) => column.story === story);
      const ties = columns.map((column) => `eje ${column.line + 1} E ${rebarLabel(column.result.ties.diameterMm)} @ ${cm(column.result.ties.centerSpacingMm)}${column.result.ties.endLengthMm > 0 ? ` (@ ${cm(column.result.ties.endSpacingMm)} en Lo)` : ''}`);
      return { label: `Columnas nivel ${story + 1}`, value: `${columnBarsText(result)} · ${ties.join(' · ')}` };
    }),
  ];
}

function frameMemo(result: FrameDesignResult): string {
  const { input } = result;
  const worstBeam = result.beams.reduce((best, beam) => beam.result.governingRatio > best.result.governingRatio ? beam : best);
  const worstColumn = result.columns.reduce((best, column) => column.result.governingRatio > best.result.governingRatio ? column : best);
  return [
    `PÓRTICO ${describeFrame(input)} · claros ${input.bays.join(' + ')} m · alturas ${input.stories.map((story) => story.heightM).join(' + ')} m · ${designCode(input.code).name}`,
    `Vigas ${input.beam.widthMm / 10}×${input.beam.heightMm / 10} cm · columnas ${input.column.widthMm / 10}×${input.column.heightMm / 10} cm (h en el plano) · base ${input.base === 'fixed' ? 'empotrada' : 'articulada'}`,
    `Combinaciones: ${result.combinations.map((combination) => combination.label).join(' · ')}; viva alternada por claro y nivel${result.lateral ? '; lateral en ambos sentidos' : ''}`,
    `Análisis del marco: ${result.loadCases} casos de carga superpuestos`,
    ...frameReinforcementRows(result).map((row) => `${row.label}: ${row.value}`),
    `Rige en vigas: nivel ${worstBeam.story + 1} (${percent(worstBeam.result.governingRatio)}) · en columnas: eje ${worstColumn.line + 1}, nivel ${worstColumn.story + 1} (${percent(worstColumn.result.governingRatio)})`,
    ...(result.lateral ? result.stories.map((story) => `Entrepiso ${story.story + 1}: V = ${formatNumber(story.shearKn, 1)} kN · Δ = ${formatNumber(story.driftMm, 2)} mm (Δ/h = ${story.driftRatio.toFixed(4)}) · índice de estabilidad ${story.stabilityIndex.toFixed(3)}`) : []),
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'info' ? '·' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${percent(check.ratio)})` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

function frameData(result: FrameDesignResult, draft: FrameDraft) {
  const { input } = result;
  const code = designCode(input.code);
  return [
    { title: 'Geometría', rows: [
      { label: 'Claros', value: `${input.bays.map((length) => formatNumber(length, 2)).join(' + ')} m` },
      { label: 'Alturas de entrepiso', value: `${input.stories.map((story) => formatNumber(story.heightM, 2)).join(' + ')} m (de abajo hacia arriba)` },
      { label: 'Base', value: input.base === 'fixed' ? 'empotrada' : 'articulada' },
      { label: 'Marco', value: input.braced ? 'arriostrado: cada nivel restringido lateralmente' : 'con desplazamiento lateral' },
    ] },
    { title: 'Secciones', rows: [
      { label: 'Vigas', value: `b = ${cm(input.beam.widthMm)} · h = ${cm(input.beam.heightMm)}` },
      { label: 'Columnas', value: `b = ${cm(input.column.widthMm)} (fuera del plano) · h = ${cm(input.column.heightMm)} (en el plano)` },
      { label: 'Armado de columnas', value: `${columnBarsText(result)}: ${input.columnReinforcement.barsAlongWidth} por cara b y ${input.columnReinforcement.barsAlongDepth} por cara h · estribo ${rebarLabel(input.columnReinforcement.tieDiameterMm)}` },
      { label: 'Recubrimiento libre', value: cm(input.coverMm) },
    ] },
    { title: 'Cargas de servicio por nivel', rows: [
      ...input.stories.map((story, index) => ({
        label: `Nivel ${index + 1}`,
        value: `CM ${formatNumber(story.deadKnPerM, 2)} · CV ${formatNumber(story.liveKnPerM, 2)} kN/m en vigas${result.lateral ? ` · lateral ${formatNumber(story.lateralKn, 1)} kN` : ''}`,
      })),
      { label: 'Peso propio', value: input.includeSelfWeight ? `vigas ${formatNumber(result.selfWeight.beamKnPerM, 2)} kN/m · columnas ${formatNumber(result.selfWeight.columnKnPerM, 2)} kN/m` : 'no incluido' },
    ] },
    { title: 'Materiales', rows: [
      { label: 'f′c', value: kgcm2(draft.fc) },
      { label: 'fy longitudinal', value: kgcm2(draft.fy) },
      { label: 'fy estribos', value: kgcm2(draft.fyv) },
      { label: 'Agregado máximo', value: `${formatNumber(input.maxAggregateMm, 0)} mm` },
    ] },
    { title: 'Criterios', rows: [
      { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
      ...(result.lateral ? [{ label: 'Con acción lateral', value: input.lateralCombinations.map((combination) => combination.label).join(' · ') }] : []),
      { label: 'Viva sostenida', value: `${Math.round(input.sustainedLiveRatio * 100)} %${code.sustainedLive === 'use' ? ` (${LIVE_LOAD_USES.find((use) => use.value === draft.use)?.label ?? draft.use})` : ''}` },
      { label: 'Duración de la carga sostenida', value: `${LONG_TERM_DURATIONS.find((item) => item.value === draft.duration)?.label ?? draft.duration} (ξ = ${input.longTermXi})` },
      { label: 'Inercias del análisis', value: `vigas ${input.beamInertiaFactor} Ig · columnas ${input.columnInertiaFactor} Ig` },
      { label: 'Longitud efectiva', value: input.effectiveLengthFactor !== null ? `k = ${input.effectiveLengthFactor} (propio)` : input.braced ? 'k = 1.0' : 'k del nomograma (al menos 1.0)' },
    ] },
  ];
}

function frameTables(result: FrameDesignResult) {
  return [
    {
      title: 'Vigas por nivel (kN·m, kN, mm)',
      columns: ['Nivel', 'M⁺', 'M⁻', 'V', 'Δ / lím', 'Rige'],
      rows: [...result.beams].reverse().map((beam) => [
        String(beam.story + 1), formatNumber(beam.result.extremes.positiveMomentKnm), formatNumber(beam.result.extremes.negativeMomentKnm), formatNumber(beam.result.extremes.shearKn),
        `${formatNumber(beam.result.deflection.checkedMm)} / ${formatNumber(beam.result.deflection.limitMm)}`, percent(beam.result.governingRatio),
      ]),
    },
    {
      title: 'Columnas: estado que rige (kN, kN·m)',
      columns: ['Eje', 'Nivel', 'Pu', 'M2', 'Mc', 'k', 'Rige'],
      rows: [...result.columns].sort((a, b) => b.story - a.story || a.line - b.line).map((column) => {
        const state = column.states[column.governingState]!;
        return [String(column.line + 1), String(column.story + 1), formatNumber(state.axialKn, 0), formatNumber(Math.max(Math.abs(state.topKnm), Math.abs(state.bottomKnm))),
          formatNumber(state.designMomentKnm), formatNumber(column.effectiveLengthFactor, 2), percent(column.result.governingRatio)];
      }),
    },
    ...(result.input.braced ? [] : [{
      title: 'Entrepisos',
      columns: ['Nivel', 'h (m)', 'V (kN)', 'Δ (mm)', 'Δ/h', 'K (kN/m)', 'Índice'],
      rows: [...result.stories].reverse().map((story) => [String(story.story + 1), formatNumber(result.input.stories[story.story]!.heightM, 2), formatNumber(story.shearKn, 1),
        formatNumber(story.driftMm, 2), story.driftRatio.toFixed(4), formatNumber(story.stiffnessKnPerM, 0), story.stabilityIndex.toFixed(3)]),
    }]),
    ...(result.joints.length ? [{
      title: 'Nudos: resistencias de diseño columnas / vigas (informativo)',
      columns: ['Eje', 'Nivel', 'ΣMc', 'ΣMv', 'ΣMc/ΣMv'],
      rows: result.joints.map((joint) => [String(joint.line + 1), String(joint.level), formatNumber(joint.columnsKnm), formatNumber(joint.beamsKnm), formatNumber(joint.ratio, 2)]),
    }] : []),
  ];
}

export function frameReport(result: FrameDesignResult, draft: FrameDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const worstBeam = result.beams.reduce((best, beam) => beam.result.governingRatio > best.result.governingRatio ? beam : best);
  const worstColumn = result.columns.reduce((best, column) => column.result.governingRatio > best.result.governingRatio ? column : best);
  const state = worstColumn.states[worstColumn.governingState]!;
  return {
    element: 'frame',
    title: frameTitle(result.input),
    tag: draft.tag.trim(),
    place: draft.place.trim(),
    code: result.input.code,
    status: result.status,
    governingRatio: result.governingRatio,
    memo: frameMemo(result),
    checks,
    notes,
    outOfScope: outOfScopeChecks('frame', result.input.code),
    input: result.input,
    data: frameData(result, draft),
    reinforcement: frameReinforcementRows(result),
    values: [
      { symbol: 'Ec', label: 'Módulo de elasticidad', value: `${formatNumber(designCode(result.input.code).elasticModulusMpa(result.input.fcMpa), 0)} MPa` },
      { symbol: 'Casos', label: 'Casos de carga superpuestos', value: String(result.loadCases) },
      { symbol: 'Vigas', label: `Rige el nivel ${worstBeam.story + 1}`, value: percent(worstBeam.result.governingRatio) },
      { symbol: 'Columnas', label: `Rige el eje ${worstColumn.line + 1}, nivel ${worstColumn.story + 1}`, value: `${percent(worstColumn.result.governingRatio)} · ${state.combination} · ${state.label}` },
      ...(result.input.braced ? [] : [{ symbol: 'Q máx', label: 'Índice de estabilidad', value: Math.max(...result.stories.map((story) => story.stabilityIndex)).toFixed(3) }]),
      ...(result.lateral ? [{ symbol: 'Δ/h máx', label: 'Deriva elástica', value: Math.max(...result.stories.map((story) => story.driftRatio)).toFixed(4) }] : []),
    ],
    tables: frameTables(result),
    takeoff: frameTakeoff(result),
    figures: [
      { title: 'Pórtico · utilización', render: () => <FrameElevation result={result} kind="ratio" /> },
      { title: 'Pórtico · envolvente de momento', render: () => <FrameElevation result={result} kind="moment" /> },
      { title: 'Pórtico · envolvente de cortante', render: () => <FrameElevation result={result} kind="shear" /> },
      { title: 'Pórtico · envolvente de carga axial', render: () => <FrameElevation result={result} kind="axial" /> },
      { title: result.lateral ? 'Pórtico · deformada lateral' : 'Pórtico · deformada de servicio', render: () => <FrameElevation result={result} kind="deformed" /> },
      { title: `Viga del nivel ${worstBeam.story + 1} · envolventes`, render: () => <BeamElevation result={worstBeam.result} supports="columns" /> },
      { title: `Viga del nivel ${worstBeam.story + 1} · armado`, render: () => <BeamRebarDetail result={worstBeam.result} supports="columns" /> },
      { title: `Columna del eje ${worstColumn.line + 1}, nivel ${worstColumn.story + 1} · interacción`, note: `${state.combination} · ${state.label}`,
        render: () => <InteractionChart result={worstColumn.result} axis="x" cloud={worstColumn.states.map((item) => ({ axialKn: item.axialKn, momentKnm: item.designMomentKnm, label: `${item.combination} · ${item.label}` }))} /> },
    ],
  };
}

/** Diseña desde un borrador guardado (memoria del proyecto). */
export function frameReportFromDraft(code: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]) {
  const result = designFrame(frameToInput(code, draft, bays, stories));
  if (!result.ok) return { ok: false as const, errors: result.errors };
  return { ok: true as const, report: frameReport(result, draft) };
}

/** Carga de línea en las vigas a partir de la losa: w = ancho tributario × carga de losa (+ muros en la muerta). */
export function frameSlabLoads(draft: FrameDraft): { dead: number; live: number } | null {
  const tributary = parseNumber(draft.tributary);
  const dead = parseNumber(draft.slabDead);
  const live = parseNumber(draft.slabLive);
  const wall = draft.wallLoad.trim() === '' ? 0 : parseNumber(draft.wallLoad);
  if (![tributary, dead, live, wall].every((value) => Number.isFinite(value) && value >= 0) || tributary <= 0) return null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return { dead: round(tributary * dead + wall), live: round(tributary * live) };
}
