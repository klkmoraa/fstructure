import { MAX_SPANS, barsText, designBeam, type BeamDesignInput, type BeamDesignResult, type BeamEnd, type SpanStirrups } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { beamTakeoff } from '../../../design/elements/takeoff';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import type { BeamDetailDraft } from './beamDetailDraft';
import { parseBeamDetails } from './beamDetailInput';
import { beamToInput } from './beamInput';
export { beamToInput } from './beamInput';
export { proposeBeamSectionCompute as proposeBeamSection } from './beamSectionProposalCompute';
import { LIVE_LOAD_USES, LONG_TERM_DURATIONS, formatNumber, isShortString, mpaFromKgcm2, parseNumber, splitChecks } from './common';
import type { DesignReport, ReportAlternative, ReportRow } from './designReport';

/**
 * Viga: del borrador del formulario a la entrada del motor y a la memoria. Lo
 * usan la mesa y la memoria del proyecto, para que ambas calculen lo mismo.
 */
export const BEAM_DEFAULTS = {
  tag: '', place: '', exercise: '',
  sectionType: 'rect', flangeWidth: '100', flangeThickness: '12', flangeClear: '0',
  width: '25', height: '50', cover: '4', fc: '250', fy: '4200', fyv: '4200', leftEnd: 'pin', rightEnd: 'pin',
  selfWeight: 'yes', points: 'no', group: 'B', use: 'habitacion', sustained: '25', duration: '60', bar: 'auto', stirrup: 'auto', aggregate: '19', damages: 'no',
  supportWidth: '40',
  rebarMode: 'auto', topCount: '2', topBar: '15.9', bottomCount: '3', bottomBar: '15.9', ownBastions: 'auto', stirrupSpacing: '',
  /** Cargas desde la losa: ancho tributario (m), muerta y viva de la losa (kN/m²) y muros sobre la viga (kN/m). */
  tributary: '3', slabDead: '4.5', slabLive: '1.9', wallLoad: '0',
};
export type BeamDraft = typeof BEAM_DEFAULTS;

export interface SpanDraft { length: string; dead: string; live: string; pointDead: string; pointLive: string; pointAt: string }
const SPAN_FIELDS = ['length', 'dead', 'live', 'pointDead', 'pointLive', 'pointAt'] as const;
export const DEFAULT_SPANS: SpanDraft[] = [
  { length: '5', dead: '15', live: '10', pointDead: '0', pointLive: '0', pointAt: '2.5' },
  { length: '4', dead: '15', live: '10', pointDead: '0', pointLive: '0', pointAt: '2' },
];

export const ENDS: { value: BeamEnd; label: string }[] = [
  { value: 'pin', label: 'Apoyo' },
  { value: 'roller', label: 'Rodillo' },
  { value: 'fixed', label: 'Empotre' },
  { value: 'free', label: 'Libre' },
];

export type BeamSupportPreset = 'simple' | 'propped' | 'fixed' | 'cantilever-left' | 'cantilever-right' | 'continuous';

/** Ajusta apoyos rápidos sin reemplazar cargas ni claros capturados. */
export function beamSupportPreset(preset: BeamSupportPreset, draft: BeamDraft, spans: readonly SpanDraft[]) {
  const ends = {
    simple: ['pin', 'pin'],
    propped: ['fixed', 'pin'],
    fixed: ['fixed', 'fixed'],
    'cantilever-left': ['fixed', 'free'],
    'cantilever-right': ['free', 'fixed'],
    continuous: ['pin', 'pin'],
  }[preset] as [string, string];
  const nextSpans = preset === 'continuous' && spans.length === 1
    ? [...spans, { ...spans[0]! }]
    : spans.map((span) => ({ ...span }));
  return { draft: { ...draft, leftEnd: ends[0]!, rightEnd: ends[1]! }, spans: nextSpans };
}

export const parseSpans = (raw: unknown): SpanDraft[] | undefined => {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SPANS) return undefined;
  const spans = raw.map((item: unknown) => {
    if (!item || typeof item !== 'object') return undefined;
    const record = item as Record<string, unknown>;
    // Borradores anteriores no tenían la posición de la carga puntual: se asume al centro.
    const pointAt = isShortString(record.pointAt) ? record.pointAt : isShortString(record.length) ? String(parseNumber(record.length) / 2) : undefined;
    const withPoint: Record<string, unknown> = { ...record, pointAt };
    return SPAN_FIELDS.every((field) => isShortString(withPoint[field])) ? Object.fromEntries(SPAN_FIELDS.map((field) => [field, withPoint[field]])) as unknown as SpanDraft : undefined;
  });
  return spans.every(Boolean) ? spans as SpanDraft[] : undefined;
};

const cm2 = (mm2: number) => `${formatNumber(mm2 / 100, 2)} cm²`;
export const cm = (mm: number) => `${formatNumber(mm / 10, 0)} cm`;
export const meters = (m: number) => formatNumber(m, 2);

export function stirrupText(stirrups: SpanStirrups, diameterMm: number) {
  const size = rebarLabel(diameterMm, 'transverse');
  if (stirrups.denseZones.length === 0) return `E ${size} @ ${cm(stirrups.denseSpacingMm)}`;
  return `E ${size} @ ${cm(stirrups.denseSpacingMm)} en zonas de cortante · @ ${cm(stirrups.centerSpacingMm)} resto`;
}

export const describeBeam = (input: BeamDesignInput) => {
  const count = input.spans.length;
  if (count === 1 && (input.leftEnd === 'free' || input.rightEnd === 'free')) return 'Voladizo';
  if (count === 1) return input.leftEnd === 'fixed' && input.rightEnd === 'fixed' ? 'Doblemente empotrada' : input.leftEnd === 'fixed' || input.rightEnd === 'fixed' ? 'Empotrada–apoyada' : 'Simplemente apoyada';
  return `Continua · ${count} claros`;
};

export const bastionTitle = (bastion: BeamDesignResult['bastions'][number]) =>
  `Bastón ${bastion.bed === 'top' ? 'superior' : 'inferior'} ${barsText(bastion.bars)}`;
export const bastionDetail = (bastion: BeamDesignResult['bastions'][number]) =>
  `x = ${meters(bastion.startM)} → ${meters(bastion.endM)} m · ${meters(bastion.endM - bastion.startM)} m · ld ${cm(bastion.developmentLengthMm)}${bastion.needsHook ? ' · con gancho' : ''}`;

export const END_LABEL = { left: 'izquierdo', right: 'derecho' } as const;
const anchorageText = (item: BeamDesignResult['anchorages'][number]) =>
  `${item.bed === 'top' ? 'Superior' : 'Inferior'} en el apoyo ${END_LABEL[item.end]}: ${item.kind === 'straight'
    ? `recta, ld ${cm(item.straightMm)}`
    : item.kind === 'hook' ? `gancho estándar, ldh ${cm(item.hookMm)}` : `no cabe (ldh ${cm(item.hookMm)} > ${cm(item.availableMm)})`}`;

const beamTitle = (result: BeamDesignResult) => {
  const { widthMm, heightMm, flange } = result.input;
  const web = `${formatNumber(widthMm / 10, 0)} × ${formatNumber(heightMm / 10, 0)} cm`;
  return flange ? `Viga ${flange.kind} ${web} · patín ${formatNumber(flange.widthMm / 10, 0)} × ${formatNumber(flange.thicknessMm / 10, 0)}` : `Viga ${web}`;
};

/** Texto de la sección para datos y memoria. */
const sectionText = (input: BeamDesignInput) => input.flange
  ? `${input.flange.kind === 'T' ? 'T (losa a ambos lados)' : 'L (losa de un lado)'}: alma bw = ${formatNumber(input.widthMm / 10, 0)} cm · h = ${formatNumber(input.heightMm / 10, 0)} cm · patín bf = ${formatNumber(input.flange.widthMm / 10, 0)} cm, hf = ${formatNumber(input.flange.thicknessMm / 10, 0)} cm${input.flange.clearDistanceMm ? ` · La = ${formatNumber(input.flange.clearDistanceMm / 1000, 2)} m` : ''}`
  : `rectangular: b = ${formatNumber(input.widthMm / 10, 0)} cm · h = ${formatNumber(input.heightMm / 10, 0)} cm`;

function beamMemo(result: BeamDesignResult, details?: BeamDetailDraft): string {
  const { input } = result;
  return [
    `VIGA ${input.flange ? `${input.flange.kind} ` : ''}${input.widthMm / 10}×${input.heightMm / 10} cm${input.flange ? ` (patín ${input.flange.widthMm / 10}×${input.flange.thicknessMm / 10})` : ''} · ${describeBeam(input)} · L = ${input.spans.map((span) => span.lengthM).join(' + ')} m · ${designCode(input.code).name}`,
    `Combinaciones: ${input.combinations.map((combination) => combination.label).join(' · ')}`,
    `Envolvente del solver 2D (${result.solverRuns} análisis): Mu+ = ${formatNumber(result.extremes.positiveMomentKnm)} kN·m · Mu− = ${formatNumber(result.extremes.negativeMomentKnm)} kN·m · Vu = ${formatNumber(result.extremes.shearKn)} kN`,
    `${input.provided ? 'Armado propio · corridas' : 'Corridas'}: ${barsText(result.continuousTop.continuous)} arriba · ${barsText(result.continuousBottom.continuous)} abajo`,
    ...result.bastions.map((bastion) => `${bastionTitle(bastion)}: ${bastionDetail(bastion)}`),
    ...result.anchorages.map((item) => `Anclaje ${anchorageText(item)}`),
    `Traslapes Clase B: superior ${cm(result.splices.top)} · inferior ${cm(result.splices.bottom)}`,
    ...result.spans.map((span, index) => `Claro ${index + 1}: ${stirrupText(span.stirrups, result.stirrupDiameterMm)} · Δ ${formatNumber(span.checkedDeflectionMm)} / ${formatNumber(span.deflectionLimitMm)} mm`),
    ...(result.input.extraLoads ?? []).map((load) => `Carga adicional ${load.category === 'dead' ? 'CM' : 'CV'} ${load.kind === 'point' ? `${formatNumber(load.startKn)} kN a ${formatNumber(load.startM)} m` : `${formatNumber(load.startKn)} → ${formatNumber(load.endKn)} kN/m de ${formatNumber(load.startM)} a ${formatNumber(load.endM)} m`} · claro ${load.spanIndex + 1} (se suma a cargas generales capturadas)`),
    ...(details?.bastions ?? []).map((bar) => `Bastón propio ${bar.bed === 'top' ? 'superior' : 'inferior'} · ${bar.count} Ø${formatNumber(parseNumber(bar.diameterMm), 1)} · x ${bar.startM}–${bar.endM} m`),
    ...(details?.stirrupZones ?? []).map((zone) => `Zona de estribos claro ${zone.span}: @${zone.endSpacingMm} mm en extremos, ${zone.endLengthM} m desde cada apoyo; centro @${zone.centerSpacingMm} mm`),
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

/** Armado del resultado como renglones título/detalle (panel, memoria y comparación). */
function beamReinforcementRows(result: BeamDesignResult): ReportRow[] {
  return [
    { label: `${barsText(result.continuousTop.continuous)} corridas arriba`, value: `As ${cm2(result.continuousTop.areaMm2)}` },
    { label: `${barsText(result.continuousBottom.continuous)} corridas abajo`, value: `As ${cm2(result.continuousBottom.areaMm2)}` },
    ...result.bastions.map((bastion) => ({ label: bastionTitle(bastion), value: bastionDetail(bastion) })),
    ...result.anchorages.filter((item) => item.kind !== 'straight').map((item) => ({ label: item.kind === 'hook' ? 'Gancho estándar' : 'Anclaje insuficiente', value: anchorageText(item) })),
    ...result.spans.map((span, index) => ({ label: `Estribos claro ${index + 1}`, value: stirrupText(span.stirrups, result.stirrupDiameterMm) })),
    { label: 'Traslapes Clase B', value: `Arriba ${cm(result.splices.top)} · abajo ${cm(result.splices.bottom)}` },
  ];
}

function beamValues(result: BeamDesignResult) {
  const code = designCode(result.input.code);
  const top = result.continuousTop;
  const bottom = result.continuousBottom;
  return [
    { symbol: 'd', label: 'Peralte efectivo · lecho superior', value: cm(top.effectiveDepthMm) },
    { symbol: 'As req', label: 'Acero requerido · lecho superior', value: cm2(top.requiredMm2) },
    { symbol: 'As mín', label: 'Acero mínimo · lecho superior', value: cm2(top.minimumMm2) },
    { symbol: 'As prov', label: 'Acero provisto · lecho superior', value: cm2(top.areaMm2) },
    { symbol: 'd', label: 'Peralte efectivo · lecho inferior', value: cm(bottom.effectiveDepthMm) },
    { symbol: 'As req', label: 'Acero requerido · lecho inferior', value: cm2(bottom.requiredMm2) },
    { symbol: 'As mín', label: 'Acero mínimo · lecho inferior', value: cm2(bottom.minimumMm2) },
    { symbol: 'As prov', label: 'Acero provisto · lecho inferior', value: cm2(bottom.areaMm2) },
    { symbol: 'As máx', label: 'Por lecho', value: cm2(bottom.maximumMm2) },
    { symbol: 'Mcr', label: 'Agrietamiento', value: `${formatNumber(result.deflection.crackingMomentKnm)} kN·m` },
    { symbol: 'Δi', label: `Inmediata claro ${result.deflection.governingSpan + 1}`, value: `${formatNumber(result.deflection.immediateMm)} mm` },
    { symbol: 'Δt', label: `Total con diferida claro ${result.deflection.governingSpan + 1}`, value: `${formatNumber(result.deflection.totalMm)} mm` },
    { symbol: 'Ec', label: 'Módulo de elasticidad', value: `${formatNumber(code.elasticModulusMpa(result.input.fcMpa), 0)} MPa` },
    { symbol: 'w pp', label: 'Peso propio', value: `${formatNumber(result.selfWeightKnPerM, 2)} kN/m` },
    { symbol: 'Estribo', label: 'Diámetro', value: rebarLabel(result.stirrupDiameterMm, 'transverse') },
    ...result.spans.map((span, index) => ({ symbol: 'Ie/Ig', label: `Claro ${index + 1}`, value: formatNumber(span.effectiveInertiaRatio, 2) })),
  ];
}

const endLabel = (end: BeamEnd) => ENDS.find((item) => item.value === end)?.label ?? end;
const kgcm2 = (value: string) => `${value} kg/cm² (${formatNumber(mpaFromKgcm2(value), 1)} MPa)`;

function beamData(result: BeamDesignResult, draft: BeamDraft, details?: BeamDetailDraft) {
  const { input } = result;
  const code = designCode(input.code);
  const points = input.spans.some((span) => span.pointDeadKn > 0 || span.pointLiveKn > 0);
  return [
    { title: 'Geometría', rows: [
      { label: 'Tipo', value: describeBeam(input) },
      { label: 'Claros', value: `${input.spans.map((span) => formatNumber(span.lengthM, 2)).join(' + ')} m` },
      { label: 'Apoyos', value: `izquierdo ${endLabel(input.leftEnd).toLowerCase()} · derecho ${endLabel(input.rightEnd).toLowerCase()}` },
      { label: 'Sección', value: sectionText(input) },
      { label: 'Recubrimiento libre', value: cm(input.coverMm) },
      { label: 'Ancho de apoyo extremo', value: cm(input.supportWidthMm) },
    ] },
    { title: 'Cargas de servicio', rows: [
      ...input.spans.map((span, index) => ({
        label: `Claro ${index + 1}`,
        value: `CM ${formatNumber(span.deadKnPerM, 2)} · CV ${formatNumber(span.liveKnPerM, 2)} kN/m${points ? ` · P CM ${formatNumber(span.pointDeadKn, 1)} · P CV ${formatNumber(span.pointLiveKn, 1)} kN a ${formatNumber(span.pointAtM, 2)} m` : ''}`,
      })),
      { label: 'Peso propio', value: input.includeSelfWeight ? `incluido, ${formatNumber(result.selfWeightKnPerM, 2)} kN/m${input.flange ? ' (alma bajo la losa; la losa va en la carga muerta)' : ''}` : 'no incluido' },
      ...(input.extraLoads?.length ? [{ label: 'Cargas adicionales', value: 'Se suman a las cargas CM/CV de los claros y a las cargas puntuales heredadas.' }, ...input.extraLoads.map((load, index) => ({
        label: `Carga ${index + 1} · claro ${load.spanIndex + 1} · ${load.category === 'dead' ? 'CM' : 'CV'}`,
        value: load.kind === 'point' ? `${formatNumber(load.startKn, 2)} kN a x = ${formatNumber(load.startM, 2)} m` : `${formatNumber(load.startKn, 2)} → ${formatNumber(load.endKn, 2)} kN/m · x = ${formatNumber(load.startM, 2)}–${formatNumber(load.endM, 2)} m`,
      }))] : []),
    ] },
    { title: 'Materiales', rows: [
      { label: 'f′c', value: kgcm2(draft.fc) },
      { label: 'fy longitudinal', value: kgcm2(draft.fy) },
      { label: 'fy estribos', value: kgcm2(draft.fyv) },
      { label: 'Agregado máximo', value: `${formatNumber(input.maxAggregateMm, 0)} mm` },
    ] },
    { title: 'Criterios', rows: [
      { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
      { label: 'Viva sostenida', value: `${Math.round(input.sustainedLiveRatio * 100)} %${code.sustainedLive === 'use' ? ` (${LIVE_LOAD_USES.find((use) => use.value === draft.use)?.label ?? draft.use})` : ''}` },
      { label: 'Duración de la carga sostenida', value: `${LONG_TERM_DURATIONS.find((item) => item.value === draft.duration)?.label ?? draft.duration} (ξ = ${input.longTermXi})` },
      { label: 'Elementos no estructurales', value: input.damagesNonstructural ? 'frágiles, ligados a la viga' : 'no susceptibles de daño' },
      { label: 'Armado', value: input.provided
        ? `propio: ${barsText(input.provided.top)} arriba · ${barsText(input.provided.bottom)} abajo · bastones ${input.provided.bastions === 'none' ? 'omitidos' : input.provided.bastions === 'custom' ? 'propios capturados' : 'propuestos'} · estribos ${input.provided.stirrupSpacingMm === null ? 'calculados' : `@ ${cm(input.provided.stirrupSpacingMm)}`}`
        : 'propuesto por el taller' },
    ] },
    ...(details && (details.bastions.length || details.stirrupZones.length) ? [{ title: 'Detalle físico proporcionado', rows: [
      ...details.bastions.map((bar, index) => ({ label: `Bastón ${index + 1} · ${bar.bed === 'top' ? 'superior' : 'inferior'}`, value: `${bar.count} Ø${formatNumber(Number(bar.diameterMm), 1)} · x = ${bar.startM}–${bar.endM} m` })),
      ...details.stirrupZones.map((zone) => ({ label: `Estribos claro ${zone.span}`, value: `Extremos @${zone.endSpacingMm} mm × ${zone.endLengthM} m desde cada apoyo · centro @${zone.centerSpacingMm} mm` })),
    ] }] : []),
  ];
}

export function beamReport(result: BeamDesignResult, draft: BeamDraft, alternative?: BeamDesignResult, details?: BeamDetailDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const altern: ReportAlternative | undefined = alternative ? {
    label: 'Armado propuesto por el taller',
    status: alternative.status,
    governingRatio: alternative.governingRatio,
    steelKg: beamTakeoff(alternative).steelKg,
    reinforcement: beamReinforcementRows(alternative),
  } : undefined;
  return {
    element: 'beam',
    title: beamTitle(result),
    tag: draft.tag.trim(),
    place: draft.place.trim(),
    code: result.input.code,
    status: result.status,
    governingRatio: result.governingRatio,
    memo: beamMemo(result, details),
    checks,
    notes,
    outOfScope: outOfScopeChecks('beam', result.input.code, { flange: Boolean(result.input.flange) }),
    input: result.input,
    data: beamData(result, draft, details),
    reinforcement: beamReinforcementRows(result),
    values: beamValues(result),
    tables: [{
      title: 'Envolvente por claro (kN·m, kN, mm)',
      columns: ['Claro', 'M⁺', 'M⁻ izq', 'M⁻ der', 'V', 'Δ', 'Δ lím'],
      rows: result.spans.map((span, index) => [
        String(index + 1), formatNumber(span.positiveMomentKnm), formatNumber(span.negativeLeftKnm), formatNumber(span.negativeRightKnm),
        formatNumber(span.shearKn), formatNumber(span.checkedDeflectionMm), formatNumber(span.deflectionLimitMm),
      ]),
    }],
    takeoff: beamTakeoff(result),
    figures: [
      { title: 'Elevación y envolventes', render: () => <BeamElevation result={result} /> },
      { title: 'Armado longitudinal', render: () => <BeamRebarDetail result={result} /> },
      ...result.cuts.map((cut) => ({ title: cut.label, note: `x = ${meters(cut.xM)} m`, render: () => <BeamSection result={result} cut={cut} /> })),
    ],
    ...(altern ? { alternative: altern } : {}),
  };
}

/** Diseña desde un borrador guardado (memoria del proyecto). */
export function beamReportFromDraft(code: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[], details?: BeamDetailDraft) {
  const physical = details ? parseBeamDetails(details, spans) : undefined;
  if (physical?.errors.length) return { ok: false as const, errors: physical.errors };
  if (physical && (physical.bastions.length || physical.stirrupZones.some(Boolean)) && draft.rebarMode !== 'own') {
    return { ok: false as const, errors: ['Activa el armado propio para aplicar los bastones y las zonas de estribos capturados.'] };
  }
  if (physical?.bastions.length && draft.ownBastions !== 'custom') {
    return { ok: false as const, errors: ['Selecciona Bastones propios para aplicar las regiones capturadas.'] };
  }
  const result = designBeam(beamToInput(code, draft, spans, true, details));
  if (!result.ok) return { ok: false as const, errors: result.errors };
  const proposed = draft.rebarMode === 'own' ? designBeam(beamToInput(code, draft, spans, false, details)) : undefined;
  return { ok: true as const, report: beamReport(result, draft, proposed?.ok ? proposed : undefined, details) };
}

/** Carga de línea por claro a partir de la losa: w = ancho tributario × carga de losa (+ muros en la muerta). */
export function slabLineLoads(draft: BeamDraft): { dead: number; live: number } | null {
  const tributary = parseNumber(draft.tributary);
  const dead = parseNumber(draft.slabDead);
  const live = parseNumber(draft.slabLive);
  const wall = draft.wallLoad.trim() === '' ? 0 : parseNumber(draft.wallLoad);
  if (![tributary, dead, live, wall].every((value) => Number.isFinite(value) && value >= 0) || tributary <= 0) return null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return { dead: round(tributary * dead + wall), live: round(tributary * live) };
}
