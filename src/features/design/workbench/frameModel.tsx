import { barsText } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { structureSourceName, type ExternalStructureSource, type StructureDesignResult } from '../../../design/elements/structure';
import { structureTakeoff } from '../../../design/elements/takeoff';
import { BeamElevation, BeamRebarDetail } from './BeamDrawings';
import { InteractionChart } from './ColumnDrawings';
import { LIVE_LOAD_USES, LONG_TERM_DURATIONS, formatNumber, mpaFromKgcm2, parseNumber, splitChecks } from './common';
import { stirrupText } from './beamModel';
import type { DesignReport, ReportRow } from './designReport';
import { FrameElevation } from './FrameDrawings';

export * from './frameCalculation';
import { describeFrame, plural, designFromDraft, type FrameDraft, type BayDraft, type StoryDraft, type StructureOutcome } from './frameCalculation';

const cm = (mm: number) => `${formatNumber(mm / 10, 0)} cm`;
const kgcm2 = (value: string) => `${value} kg/cm² (${formatNumber(mpaFromKgcm2(value), 1)} MPa)`;
const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';
const countText = (result: StructureDesignResult) => `${plural(result.beams.length, 'línea de viga', 'líneas de viga')} · ${plural(result.columns.length, 'columna', 'columnas')}`;

export const describeStructure = (outcome: Extract<StructureOutcome, { ok: true }>) =>
  outcome.frame ? describeFrame(outcome.frame.input) : `${structureSourceName(outcome.result.source.kind)} · ${countText(outcome.result)}${outcome.result.braced ? ' · arriostrado' : ''}`;

const structureTitle = (outcome: Extract<StructureOutcome, { ok: true }>) => {
  if (outcome.frame) {
    const { input } = outcome.frame;
    return `Pórtico ${describeFrame(input)} · V ${formatNumber(input.beam.widthMm / 10, 0)}×${formatNumber(input.beam.heightMm / 10, 0)} · C ${formatNumber(input.column.widthMm / 10, 0)}×${formatNumber(input.column.heightMm / 10, 0)}`;
  }
  const name = structureSourceName(outcome.result.source.kind);
  return `${name} «${outcome.result.source.label.replace(`${name} · `, '')}» · ${countText(outcome.result)}`;
};

const columnBarsText = (result: StructureDesignResult) => [...new Set(result.columns.map((column) =>
  `${column.result.bars.length} ${rebarLabel(column.result.input.barDiameterMm)}`))].join(' / ');

const sectionText = (section: { widthMm: number; heightMm: number }) => `${formatNumber(section.widthMm / 10, 0)}×${formatNumber(section.heightMm / 10, 0)}`;

/** Armado por miembro como renglones (panel y memoria). */
function structureReinforcementRows(result: StructureDesignResult): ReportRow[] {
  return [
    ...[...result.beams].reverse().map((beam) => ({
      label: beam.label,
      value: [
        `${barsText(beam.result.continuousTop.continuous)} arriba · ${barsText(beam.result.continuousBottom.continuous)} abajo`,
        ...(beam.result.bastions.length ? [`${beam.result.bastions.length} bastones`] : []),
        ...beam.result.spans.map((span, index) => `tramo ${index + 1}: ${stirrupText(span.stirrups, beam.result.stirrupDiameterMm)}`),
      ].join(' · '),
    })),
    ...[...new Set(result.columns.map((column) => column.story))].reverse().map((story) => {
      const columns = result.columns.filter((column) => column.story === story);
      const ties = columns.map((column) => `eje ${column.axisLabel} E ${rebarLabel(column.result.ties.diameterMm)} @ ${cm(column.result.ties.centerSpacingMm)}${column.result.ties.endLengthMm > 0 ? ` (@ ${cm(column.result.ties.endSpacingMm)} en Lo)` : ''}`);
      return { label: `Columnas del entrepiso ${story + 1}`, value: `${columns.map((column) => `${column.result.bars.length} ${rebarLabel(column.result.input.barDiameterMm)}`).join(' / ')} · ${ties.join(' · ')}` };
    }),
  ];
}

const worstOf = <T extends { result: { governingRatio: number } }>(items: readonly T[]) =>
  items.length ? items.reduce((best, item) => item.result.governingRatio > best.result.governingRatio ? item : best) : undefined;

/** Nombre del modelo de origen sin el prefijo de la fuente. */
const modelName = (result: StructureDesignResult) => result.source.label.replace(`${structureSourceName(result.source.kind)} · `, '');

function structureMemo(outcome: Extract<StructureOutcome, { ok: true }>): string {
  const { result, frame } = outcome;
  const worstBeam = worstOf(result.beams);
  const worstColumn = worstOf(result.columns);
  return [
    frame
      ? `PÓRTICO ${describeFrame(frame.input)} · claros ${frame.input.bays.join(' + ')} m · alturas ${frame.input.stories.map((story) => story.heightM).join(' + ')} m · ${designCode(result.options.code).name}`
      : `${structureSourceName(result.source.kind).toUpperCase()} «${modelName(result)}» · ${countText(result)} · ${designCode(result.options.code).name}`,
    frame
      ? `Vigas ${frame.input.beam.widthMm / 10}×${frame.input.beam.heightMm / 10} cm · columnas ${frame.input.column.widthMm / 10}×${frame.input.column.heightMm / 10} cm (h en el plano) · base ${frame.input.base === 'fixed' ? 'empotrada' : 'articulada'}`
      : `Secciones del modelo: ${[...new Set(result.members.filter((member) => member.kind !== 'other').map((member) => `${member.kind === 'beam' ? 'V' : 'C'} ${sectionText(frameSection(result, member.index))}`))].join(' · ')} cm`,
    `Combinaciones: ${result.combinations.map((combination) => combination.label).join(' · ')}; viva alternada ${frame ? 'por claro y nivel' : 'por barra cargada'}${result.lateral ? '; lateral en ambos sentidos' : ''}`,
    `Análisis: ${result.loadCases} casos de carga superpuestos${frame ? '' : result.source.kind === 'model3d' ? ' con el solver 3D (modelo completo, acciones en el plano del eje)' : ' con el solver 2D'}`,
    ...structureReinforcementRows(result).map((row) => `${row.label}: ${row.value}`),
    `Rige${worstBeam ? ` en vigas: ${worstBeam.label.toLowerCase()} (${percent(worstBeam.result.governingRatio)})` : ''}${worstColumn ? ` · en columnas: ${worstColumn.label.toLowerCase()} (${percent(worstColumn.result.governingRatio)})` : ''}`,
    ...(result.lateral ? result.stories.map((story) => `Entrepiso ${story.index + 1}: V = ${formatNumber(story.shearKn, 1)} kN · Δ = ${formatNumber(story.driftMm, 2)} mm (Δ/h = ${story.driftRatio.toFixed(4)}) · índice de estabilidad ${story.stabilityIndex.toFixed(3)}`) : []),
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'info' ? '·' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${percent(check.ratio)})` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

/** Sección de diseño de un miembro de la estructura. */
const frameSection = (result: StructureDesignResult, memberIndex: number) => {
  const beam = result.beams.find((item) => item.memberIndexes.includes(memberIndex));
  if (beam) return { widthMm: beam.result.input.widthMm, heightMm: beam.result.input.heightMm };
  const column = result.columns.find((item) => item.memberIndex === memberIndex);
  return column ? { widthMm: column.result.input.widthMm, heightMm: column.result.input.depthMm } : { widthMm: 0, heightMm: 0 };
};

function structureData(outcome: Extract<StructureOutcome, { ok: true }>, draft: FrameDraft) {
  const { result, frame } = outcome;
  const code = designCode(result.options.code);
  const options = result.options;
  const geometry = frame ? [
    { title: 'Geometría', rows: [
      { label: 'Claros', value: `${frame.input.bays.map((length) => formatNumber(length, 2)).join(' + ')} m` },
      { label: 'Alturas de entrepiso', value: `${frame.input.stories.map((story) => formatNumber(story.heightM, 2)).join(' + ')} m (de abajo hacia arriba)` },
      { label: 'Base', value: frame.input.base === 'fixed' ? 'empotrada' : 'articulada' },
      { label: 'Marco', value: frame.input.braced ? 'arriostrado: cada nivel restringido lateralmente' : 'con desplazamiento lateral' },
    ] },
    { title: 'Secciones', rows: [
      { label: 'Vigas', value: `b = ${cm(frame.input.beam.widthMm)} · h = ${cm(frame.input.beam.heightMm)}` },
      { label: 'Columnas', value: `b = ${cm(frame.input.column.widthMm)} (fuera del plano) · h = ${cm(frame.input.column.heightMm)} (en el plano)` },
      { label: 'Armado de columnas', value: `${columnBarsText(result)}: ${options.columnReinforcement.barsAlongWidth} por cara b y ${options.columnReinforcement.barsAlongDepth} por cara h · estribo ${rebarLabel(options.columnReinforcement.tieDiameterMm)}` },
      { label: 'Recubrimiento libre', value: cm(options.coverMm) },
    ] },
    { title: 'Cargas de servicio por nivel', rows: [
      ...frame.input.stories.map((story, index) => ({
        label: `Nivel ${index + 1}`,
        value: `CM ${formatNumber(story.deadKnPerM, 2)} · CV ${formatNumber(story.liveKnPerM, 2)} kN/m en vigas${result.lateral ? ` · lateral ${formatNumber(story.lateralKn, 1)} kN` : ''}`,
      })),
      { label: 'Peso propio', value: frame.input.includeSelfWeight ? `vigas ${formatNumber(frame.selfWeight.beamKnPerM, 2)} kN/m · columnas ${formatNumber(frame.selfWeight.columnKnPerM, 2)} kN/m` : 'no incluido' },
    ] },
  ] : [
    { title: `Origen: ${structureSourceName(result.source.kind)}`, rows: [
      { label: result.source.kind === 'model3d' ? 'Modelo y eje' : 'Modelo', value: modelName(result) },
      { label: 'Miembros', value: `${countText(result)}${result.skipped.length ? ` · ${result.skipped.length} sin diseñar` : ''}` },
      { label: 'Casos', value: 'Permanentes como carga muerta, variables como viva alternada por barra y accidentales como acción lateral; las combinaciones son las de la norma.' },
      { label: 'Marco', value: result.braced ? 'arriostrado: sin amplificación por desplazamiento' : 'con desplazamiento lateral' },
      { label: 'Peso propio', value: options.includeSelfWeight ? 'incluido en los casos permanentes del modelo' : 'no incluido en el modelo' },
    ] },
    { title: 'Secciones', rows: [
      ...result.beams.map((beam) => ({ label: beam.label, value: `b = ${cm(beam.result.input.widthMm)} · h = ${cm(beam.result.input.heightMm)}` })),
      ...result.columns.map((column) => ({ label: column.label, value: `b = ${cm(column.result.input.widthMm)} · h = ${cm(column.result.input.depthMm)}` })),
      { label: 'Armado de columnas', value: `${columnBarsText(result)}: ${options.columnReinforcement.barsAlongWidth} por cara b y ${options.columnReinforcement.barsAlongDepth} por cara h · estribo ${rebarLabel(options.columnReinforcement.tieDiameterMm)}` },
      { label: 'Recubrimiento libre', value: cm(options.coverMm) },
    ] },
  ];
  return [
    ...geometry,
    { title: 'Materiales', rows: [
      { label: 'f′c', value: frame ? kgcm2(draft.fc) : `${formatNumber(options.fcMpa, 1)} MPa` },
      { label: 'fy longitudinal', value: kgcm2(draft.fy) },
      { label: 'fy estribos', value: kgcm2(draft.fyv) },
      { label: 'Agregado máximo', value: `${formatNumber(options.maxAggregateMm, 0)} mm` },
    ] },
    { title: 'Criterios', rows: [
      { label: 'Combinaciones', value: options.combinations.map((combination) => combination.label).join(' · ') },
      ...(result.lateral ? [{ label: 'Con acción lateral', value: options.lateralCombinations.map((combination) => combination.label).join(' · ') }] : []),
      { label: 'Viva sostenida', value: `${Math.round(options.sustainedLiveRatio * 100)} %${code.sustainedLive === 'use' ? ` (${LIVE_LOAD_USES.find((use) => use.value === draft.use)?.label ?? draft.use})` : ''}` },
      { label: 'Duración de la carga sostenida', value: `${LONG_TERM_DURATIONS.find((item) => item.value === draft.duration)?.label ?? draft.duration} (ξ = ${options.longTermXi})` },
      ...(frame ? [{ label: 'Inercias del análisis', value: `vigas ${frame.input.beamInertiaFactor} Ig · columnas ${frame.input.columnInertiaFactor} Ig` }] : [{ label: 'Inercias del análisis', value: `las del ${structureSourceName(result.source.kind)}` }]),
      { label: 'Longitud efectiva', value: options.effectiveLengthFactor !== null ? `k = ${options.effectiveLengthFactor} (propio)` : result.braced ? 'k = 1.0' : 'k del nomograma (al menos 1.0)' },
    ] },
  ];
}

function structureTables(result: StructureDesignResult) {
  const biaxial = result.columns.some((column) => column.states.some((state) => state.outOfPlaneKnm !== undefined));
  return [
    {
      title: 'Vigas (kN·m, kN, mm)',
      columns: ['Viga', 'M⁺', 'M⁻', 'V', 'Δ / lím', 'Rige'],
      rows: [...result.beams].reverse().map((beam) => [
        beam.label, formatNumber(beam.result.extremes.positiveMomentKnm), formatNumber(beam.result.extremes.negativeMomentKnm), formatNumber(beam.result.extremes.shearKn),
        `${formatNumber(beam.result.deflection.checkedMm)} / ${formatNumber(beam.result.deflection.limitMm)}`, percent(beam.result.governingRatio),
      ]),
    },
    {
      title: 'Columnas: estado que rige (kN, kN·m)',
      columns: biaxial ? ['Columna', 'Pu', 'M2', 'Mc', 'M⊥c', 'k', 'Rige'] : ['Columna', 'Pu', 'M2', 'Mc', 'k', 'Rige'],
      rows: [...result.columns].sort((a, b) => b.story - a.story || a.axis - b.axis).map((column) => {
        const state = column.states[column.governingState]!;
        return [column.label, formatNumber(state.axialKn, 0), formatNumber(Math.max(Math.abs(state.topKnm), Math.abs(state.bottomKnm))),
          formatNumber(state.designMomentKnm), ...(biaxial ? [formatNumber(state.outOfPlaneDesignKnm ?? 0)] : []),
          formatNumber(column.effectiveLengthFactor, 2), percent(column.result.governingRatio)];
      }),
    },
    ...(result.braced || !result.stories.length ? [] : [{
      title: 'Entrepisos',
      columns: ['Entrepiso', 'h (m)', 'V (kN)', 'Δ (mm)', 'Δ/h', 'K (kN/m)', 'Índice'],
      rows: [...result.stories].reverse().map((story) => [String(story.index + 1), formatNumber(story.heightM, 2), formatNumber(story.shearKn, 1),
        formatNumber(story.driftMm, 2), story.driftRatio.toFixed(4), Number.isFinite(story.stiffnessKnPerM) ? formatNumber(story.stiffnessKnPerM, 0) : '—', story.stabilityIndex.toFixed(3)]),
    }]),
    ...(result.joints.length ? [{
      title: 'Nudos: resistencias de diseño columnas / vigas (informativo)',
      columns: ['Nudo', 'ΣMc', 'ΣMv', 'ΣMc/ΣMv'],
      rows: result.joints.map((joint) => [joint.label, formatNumber(joint.columnsKnm), formatNumber(joint.beamsKnm), formatNumber(joint.ratio, 2)]),
    }] : []),
  ];
}

export function structureReport(outcome: Extract<StructureOutcome, { ok: true }>, draft: FrameDraft): DesignReport {
  const { result, frame } = outcome;
  const [checks, notes] = splitChecks(result.checks);
  const worstBeam = worstOf(result.beams);
  const worstColumn = worstOf(result.columns);
  const state = worstColumn?.states[worstColumn.governingState];
  const name = frame ? 'Pórtico' : structureSourceName(result.source.kind);
  return {
    element: 'frame',
    title: structureTitle(outcome),
    tag: draft.tag.trim(),
    place: draft.place.trim(),
    code: result.options.code,
    status: result.status,
    governingRatio: result.governingRatio,
    memo: structureMemo(outcome),
    checks,
    notes,
    outOfScope: outOfScopeChecks('frame', result.options.code, { biaxialColumns: result.source.kind === 'model3d' }),
    input: frame ? frame.input : { source: result.source, options: result.options, members: result.members.map((member) => ({ id: member.id, kind: member.kind, start: member.start, end: member.end })) },
    data: structureData(outcome, draft),
    reinforcement: structureReinforcementRows(result),
    values: [
      { symbol: 'Ec', label: frame ? 'Módulo de elasticidad' : 'Módulo de elasticidad (f′c de diseño)', value: `${formatNumber(designCode(result.options.code).elasticModulusMpa(result.options.fcMpa), 0)} MPa` },
      { symbol: 'Casos', label: 'Casos de carga superpuestos', value: String(result.loadCases) },
      ...(worstBeam ? [{ symbol: 'Vigas', label: `Rige ${worstBeam.label.toLowerCase()}`, value: percent(worstBeam.result.governingRatio) }] : []),
      ...(worstColumn && state ? [{ symbol: 'Columnas', label: `Rige ${worstColumn.label.toLowerCase()}`, value: `${percent(worstColumn.result.governingRatio)} · ${state.combination} · ${state.label}` }] : []),
      ...(result.braced || !result.stories.length ? [] : [{ symbol: 'Q máx', label: 'Índice de estabilidad', value: Math.max(...result.stories.map((story) => story.stabilityIndex)).toFixed(3) }]),
      ...(result.lateral && result.stories.length ? [{ symbol: 'Δ/h máx', label: 'Deriva elástica', value: Math.max(...result.stories.map((story) => story.driftRatio)).toFixed(4) }] : []),
    ],
    tables: structureTables(result),
    takeoff: structureTakeoff(result),
    figures: [
      { title: `${name} · utilización`, render: () => <FrameElevation result={result} kind="ratio" /> },
      { title: `${name} · envolvente de momento`, render: () => <FrameElevation result={result} kind="moment" /> },
      { title: `${name} · envolvente de cortante`, render: () => <FrameElevation result={result} kind="shear" /> },
      { title: `${name} · envolvente de carga axial`, render: () => <FrameElevation result={result} kind="axial" /> },
      { title: result.lateral ? `${name} · deformada lateral` : `${name} · deformada de servicio`, render: () => <FrameElevation result={result} kind="deformed" /> },
      ...(worstBeam ? [
        { title: `${worstBeam.label} · envolventes`, render: () => <BeamElevation result={worstBeam.result} supports={result.columns.length ? 'columns' : 'ideal'} /> },
        { title: `${worstBeam.label} · armado`, render: () => <BeamRebarDetail result={worstBeam.result} supports={result.columns.length ? 'columns' : 'ideal'} /> },
      ] : []),
      ...(worstColumn && state ? [{ title: `${worstColumn.label} · interacción`, note: `${state.combination} · ${state.label}`,
        render: () => <InteractionChart result={worstColumn.result} axis="x" cloud={worstColumn.states.map((item) => ({ axialKn: item.axialKn, momentKnm: item.designMomentKnm, label: `${item.combination} · ${item.label}` }))} /> }] : []),
    ],
  };
}

/** Diseña desde un borrador guardado (memoria del proyecto). */
export function frameReportFromDraft(code: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[], external?: ExternalStructureSource | null) {
  const outcome = designFromDraft(code, draft, bays, stories, external);
  if (!outcome.ok) return { ok: false as const, errors: outcome.errors };
  return { ok: true as const, report: structureReport(outcome, draft) };
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
