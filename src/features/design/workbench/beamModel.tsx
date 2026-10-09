import { MAX_SPANS, barsText, designBeam, type BeamDesignInput, type BeamDesignResult, type BeamEnd, type SpanStirrups } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { beamTakeoff } from '../../../design/elements/takeoff';
import { BeamElevation, BeamRebarDetail, BeamSection } from './BeamDrawings';
import { LIVE_LOAD_USES, LONG_TERM_DURATIONS, formatNumber, isShortString, mpaFromKgcm2, parseNumber, splitChecks, sustainedRatioFor, xiFor } from './common';
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
type BeamDraft = typeof BEAM_DEFAULTS;

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

const toEnd = (value: string): BeamEnd => ENDS.some((item) => item.value === value) ? value as BeamEnd : 'pin';

export const beamToInput = (codeId: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[], useOwn = true): BeamDesignInput => ({
  code: codeId,
  widthMm: parseNumber(draft.width) * 10,
  heightMm: parseNumber(draft.height) * 10,
  coverMm: parseNumber(draft.cover) * 10,
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  fyStirrupMpa: mpaFromKgcm2(draft.fyv),
  spans: spans.map((span) => {
    const points = draft.points === 'yes';
    return {
      lengthM: parseNumber(span.length),
      deadKnPerM: parseNumber(span.dead),
      liveKnPerM: parseNumber(span.live),
      pointDeadKn: points ? parseNumber(span.pointDead) : 0,
      pointLiveKn: points ? parseNumber(span.pointLive) : 0,
      pointAtM: points ? parseNumber(span.pointAt) : parseNumber(span.length) / 2,
    };
  }),
  leftEnd: toEnd(draft.leftEnd),
  rightEnd: toEnd(draft.rightEnd),
  includeSelfWeight: draft.selfWeight === 'yes',
  combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
  sustainedLiveRatio: designCode(codeId).sustainedLive === 'use' ? sustainedRatioFor(draft.use) : parseNumber(draft.sustained) / 100,
  longTermXi: xiFor(draft.duration),
  barDiameterMm: draft.bar === 'auto' ? null : parseNumber(draft.bar),
  stirrupDiameterMm: draft.stirrup === 'auto' ? null : parseNumber(draft.stirrup),
  maxAggregateMm: parseNumber(draft.aggregate),
  damagesNonstructural: draft.damages === 'yes',
  supportWidthMm: parseNumber(draft.supportWidth) * 10,
  flange: draft.sectionType === 'T' || draft.sectionType === 'L'
    ? { kind: draft.sectionType, widthMm: parseNumber(draft.flangeWidth) * 10, thicknessMm: parseNumber(draft.flangeThickness) * 10, clearDistanceMm: parseNumber(draft.flangeClear) * 1000 }
    : null,
  provided: useOwn && draft.rebarMode === 'own' ? {
    top: { count: parseNumber(draft.topCount), diameterMm: parseNumber(draft.topBar) },
    bottom: { count: parseNumber(draft.bottomCount), diameterMm: parseNumber(draft.bottomBar) },
    bastions: draft.ownBastions === 'none' ? 'none' : 'auto',
    stirrupSpacingMm: draft.stirrupSpacing.trim() === '' ? null : parseNumber(draft.stirrupSpacing) * 10,
  } : null,
});

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

function beamMemo(result: BeamDesignResult): string {
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
  return [
    { symbol: 'd', label: 'Peralte efectivo (corridas)', value: cm(result.continuousBottom.effectiveDepthMm) },
    { symbol: 'As mín', label: 'Lecho inferior', value: cm2(code.beam.minimumSteel(result.input.widthMm, result.continuousBottom.effectiveDepthMm, result.input.heightMm, result.input.fcMpa, result.input.fyMpa, result.continuousBottom.extremeDepthMm)) },
    { symbol: 'As máx', label: 'Por lecho', value: cm2(result.continuousBottom.maximumMm2) },
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

function beamData(result: BeamDesignResult, draft: BeamDraft) {
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
        ? `propio: ${barsText(input.provided.top)} arriba · ${barsText(input.provided.bottom)} abajo · bastones ${input.provided.bastions === 'none' ? 'omitidos' : 'propuestos'} · estribos ${input.provided.stirrupSpacingMm === null ? 'calculados' : `@ ${cm(input.provided.stirrupSpacingMm)}`}`
        : 'propuesto por el taller' },
    ] },
  ];
}

export function beamReport(result: BeamDesignResult, draft: BeamDraft, alternative?: BeamDesignResult): DesignReport {
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
    memo: beamMemo(result),
    checks,
    notes,
    outOfScope: outOfScopeChecks('beam', result.input.code, { flange: Boolean(result.input.flange) }),
    input: result.input,
    data: beamData(result, draft),
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
export function beamReportFromDraft(code: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[]) {
  const result = designBeam(beamToInput(code, draft, spans));
  if (!result.ok) return { ok: false as const, errors: result.errors };
  const proposed = draft.rebarMode === 'own' ? designBeam(beamToInput(code, draft, spans, false)) : undefined;
  return { ok: true as const, report: beamReport(result, draft, proposed?.ok ? proposed : undefined) };
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

const WIDTHS_CM = [20, 25, 30, 35, 40, 45, 50];

/**
 * Sección mínima que cumple: para cada ancho, el menor peralte (de 5 en 5 cm)
 * con el que la viga no reprueba ninguna comprobación con el armado propuesto;
 * gana la de menor área con peralte entre 1 y 3 veces el ancho.
 */
export function proposeBeamSection(codeId: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[]): { width: string; height: string } | null {
  const longest = Math.max(...spans.map((span) => parseNumber(span.length)).filter(Number.isFinite), 0);
  if (!(longest > 0)) return null;
  const start = Math.max(30, Math.ceil(longest * 100 / 16 / 5) * 5);
  let best: { width: number; height: number } | null = null;
  for (const width of WIDTHS_CM) {
    for (let height = Math.max(start, width); height <= Math.min(150, 3 * width); height += 5) {
      if (best && width * height >= best.width * best.height) break;
      const trial = designBeam(beamToInput(codeId, { ...draft, width: String(width), height: String(height) }, spans, false));
      if (trial.ok && trial.status !== 'fail') {
        best = { width, height };
        break;
      }
    }
  }
  return best ? { width: String(best.width), height: String(best.height) } : null;
}
