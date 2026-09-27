import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designFooting, type FootingDesignInput, type FootingDesignResult, type FootingDirection } from '../../../design/elements/footing';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { footingTakeoff } from '../../../design/elements/takeoff';
import { formatNumber, mpaFromKgcm2, parseNumber, splitChecks } from './common';
import type { DesignReport, ReportRow } from './designReport';
import { FootingPlan, FootingSection } from './FootingDrawings';

/** Zapata aislada: del borrador del formulario a la entrada del motor y a la memoria. */
export const FOOTING_DEFAULTS = {
  tag: '', place: '',
  c1: '40', c2: '40', dead: '600', live: '300', group: 'B', seismic: 'no', qa: '150', fc: '250', fy: '4200',
  moments: 'no', mx: '0', my: '60', mux: '0', muy: '85',
  autoPlan: 'yes', sideX: '250', sideY: '250', autoThickness: 'yes', thickness: '50', cover: '7.5', bar: '15.9',
};

type FootingDraft = typeof FOOTING_DEFAULTS;

export const footingToInput = (codeId: DesignCodeId, draft: FootingDraft): FootingDesignInput => {
  const moments = draft.moments === 'yes';
  const code = designCode(codeId);
  return {
    code: codeId,
    columnWidthMm: parseNumber(draft.c1) * 10,
    columnDepthMm: parseNumber(draft.c2) * 10,
    deadKn: parseNumber(draft.dead),
    liveKn: parseNumber(draft.live),
    combinations: code.loadCombinations(draft.group === 'A' ? 'A' : 'B'),
    seismicCombination: code.usesStructureGroup && moments && draft.seismic === 'yes',
    serviceMomentXKnm: moments ? parseNumber(draft.mx) : 0,
    serviceMomentYKnm: moments ? parseNumber(draft.my) : 0,
    ultimateMomentXKnm: moments ? parseNumber(draft.mux) : 0,
    ultimateMomentYKnm: moments ? parseNumber(draft.muy) : 0,
    allowablePressureKpa: parseNumber(draft.qa),
    fcMpa: mpaFromKgcm2(draft.fc),
    fyMpa: mpaFromKgcm2(draft.fy),
    sideXMm: draft.autoPlan === 'yes' ? null : parseNumber(draft.sideX) * 10,
    sideYMm: draft.autoPlan === 'yes' ? null : parseNumber(draft.sideY) * 10,
    thicknessMm: draft.autoThickness === 'yes' ? null : parseNumber(draft.thickness) * 10,
    coverMm: parseNumber(draft.cover) * 10,
    barDiameterMm: parseNumber(draft.bar),
  };
};

const meters = (mm: number) => formatNumber(mm / 1000, 2);
export const planText = (result: FootingDesignResult) => `${meters(result.sideXMm)} × ${meters(result.sideYMm)} m`;

export const directionTitle = (direction: FootingDirection, diameterMm: number) =>
  `${direction.axis.toUpperCase()}: ${direction.barCount} ${rebarLabel(diameterMm)} @ ${formatNumber(direction.spacingMm / 10, 0)} cm`;
export const directionDetail = (direction: FootingDirection) => {
  const band = direction.band
    ? ` · ${direction.band.barsInBand} en la banda central de ${meters(direction.band.widthMm)} m (@ ${formatNumber(direction.band.spacingInBandMm / 10, 0)} cm), resto @ ${formatNumber(direction.band.spacingOutsideMm / 10, 0)} cm`
    : '';
  const anchorage = direction.anchorage === 'straight' ? '' : direction.anchorage === 'hook' ? ` · gancho estándar (ldh ${formatNumber(direction.hookLengthMm / 10, 0)} cm)` : ' · anclaje insuficiente';
  return `Capa ${direction.layer === 'bottom' ? 'inferior' : 'superior'} · As ${formatNumber(direction.providedMm2 / 100, 2)} cm² (req. ${formatNumber(Math.max(direction.requiredMm2, direction.minimumMm2, direction.punchingMinimumMm2) / 100, 2)})${band}${anchorage}`;
};

function footingMemo(result: FootingDesignResult): string {
  const { input } = result;
  return [
    `ZAPATA AISLADA ${planText(result)} · h = ${formatNumber(result.thicknessMm / 10, 0)} cm · ${designCode(input.code).name}`,
    `Combinaciones: ${input.combinations.map((combination) => combination.label).join(' · ')} · Pu = ${formatNumber(result.ultimateAxialKn, 0)} kN`,
    `Columna ${input.columnWidthMm / 10}×${input.columnDepthMm / 10} cm · P = ${input.deadKn + input.liveKn} kN · Mx = ${input.serviceMomentXKnm} · My = ${input.serviceMomentYKnm} kN·m (servicio)`,
    `Presión de servicio ${formatNumber(result.service.minimumKpa, 0)} a ${formatNumber(result.service.maximumKpa, 0)} kPa · admisible ${input.allowablePressureKpa} kPa`,
    `Refuerzo ${directionTitle(result.directions.x, input.barDiameterMm)} · ${directionTitle(result.directions.y, input.barDiameterMm)}`,
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

const footingTitle = (result: FootingDesignResult) => `Zapata ${planText(result)}`;

function footingReinforcementRows(result: FootingDesignResult): ReportRow[] {
  return [result.directions.x, result.directions.y].map((direction) => ({
    label: directionTitle(direction, result.input.barDiameterMm),
    value: directionDetail(direction),
  }));
}

function footingValues(result: FootingDesignResult) {
  const code = designCode(result.input.code);
  return [
    { symbol: 'B × L × h', label: 'Dimensiones', value: `${planText(result)} · h ${formatNumber(result.thicknessMm / 10, 0)} cm` },
    { symbol: 'd', label: 'Peralte efectivo medio', value: `${formatNumber(result.effectiveDepthMm / 10, 1)} cm` },
    { symbol: 'A', label: 'Área de contacto', value: `${formatNumber(result.sideXMm * result.sideYMm / 1e6, 2)} m²` },
    { symbol: 'ex · ey', label: 'Excentricidad', value: `${formatNumber(result.service.eccentricityXMm / 10, 1)} · ${formatNumber(result.service.eccentricityYMm / 10, 1)} cm` },
    { symbol: 'q', label: 'Servicio mín · máx', value: `${formatNumber(result.service.minimumKpa, 0)} · ${formatNumber(result.service.maximumKpa, 0)} kPa` },
    { symbol: 'qu', label: 'Última mín · máx', value: `${formatNumber(result.ultimate.minimumKpa, 0)} · ${formatNumber(result.ultimate.maximumKpa, 0)} kPa` },
    { symbol: 'Pu', label: 'Carga axial última', value: `${formatNumber(result.ultimateAxialKn, 0)} kN` },
    { symbol: 'bo', label: 'Perímetro crítico', value: `${formatNumber(result.punching.perimeterMm / 10, 0)} cm` },
    { symbol: 'Vu', label: 'Penetración directa', value: `${formatNumber(result.punching.demandKn, 0)} kN` },
    { symbol: 'vu / φvc', label: 'Esfuerzo de penetración', value: `${formatNumber(result.punching.demandStressMpa, 2)} / ${formatNumber(result.punching.strengthStressMpa, 2)} MPa` },
    ...(code.footing.punchingSizeFactor ? [{ symbol: 'λs', label: 'Efecto de tamaño (penetración)', value: formatNumber(result.punching.sizeFactor, 3) }] : []),
    { symbol: 'φ', label: 'Cortante · penetración', value: `${code.shearFactor} · ${result.punching.resistanceFactor}` },
    { symbol: 'Mu', label: 'Flexión en el paño X · Y', value: `${formatNumber(result.directions.x.momentKnm, 1)} · ${formatNumber(result.directions.y.momentKnm, 1)} kN·m` },
    { symbol: 'ld · ldh', label: 'Recta / gancho X', value: `${formatNumber(result.directions.x.developmentLengthMm / 10, 0)} / ${formatNumber(result.directions.x.hookLengthMm / 10, 0)} cm` },
    { symbol: 'd mín', label: 'Peralte efectivo mínimo', value: `${formatNumber(code.footing.minimumEffectiveDepthMm / 10, 0)} cm` },
    { symbol: 'Vu / φVc', label: 'Como viga X', value: `${formatNumber(result.directions.x.oneWayDemandKn, 0)} / ${formatNumber(result.directions.x.oneWayStrengthKn, 0)} kN` },
    { symbol: 'Vu / φVc', label: 'Como viga Y', value: `${formatNumber(result.directions.y.oneWayDemandKn, 0)} / ${formatNumber(result.directions.y.oneWayStrengthKn, 0)} kN` },
  ];
}

const kgcm2 = (value: string) => `${value} kg/cm² (${formatNumber(mpaFromKgcm2(value), 1)} MPa)`;

function footingData(result: FootingDesignResult, draft: FootingDraft) {
  const { input } = result;
  const moments = input.serviceMomentXKnm !== 0 || input.serviceMomentYKnm !== 0 || input.ultimateMomentXKnm !== 0 || input.ultimateMomentYKnm !== 0;
  return [
    { title: 'Cargas', rows: [
      { label: 'Servicio', value: `CM ${formatNumber(input.deadKn, 1)} kN · CV ${formatNumber(input.liveKn, 1)} kN` },
      { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
      ...(moments ? [
        { label: 'Momentos de servicio', value: `Mx ${formatNumber(input.serviceMomentXKnm, 1)} · My ${formatNumber(input.serviceMomentYKnm, 1)} kN·m` },
        { label: 'Momentos últimos', value: `Mux ${formatNumber(input.ultimateMomentXKnm, 1)} · Muy ${formatNumber(input.ultimateMomentYKnm, 1)} kN·m${input.seismicCombination ? ' · con sismo' : ''}` },
      ] : []),
    ] },
    { title: 'Columna y suelo', rows: [
      { label: 'Columna', value: `c1 = ${formatNumber(input.columnWidthMm / 10, 0)} cm (X) · c2 = ${formatNumber(input.columnDepthMm / 10, 0)} cm (Y)` },
      { label: 'Presión admisible neta', value: `${formatNumber(input.allowablePressureKpa, 0)} kPa (del estudio geotécnico)` },
    ] },
    { title: 'Dimensiones y materiales', rows: [
      { label: 'Planta', value: input.sideXMm === null ? `automática → ${planText(result)}` : planText(result) },
      { label: 'Peralte', value: input.thicknessMm === null ? `automático → ${formatNumber(result.thicknessMm / 10, 0)} cm` : `${formatNumber(result.thicknessMm / 10, 0)} cm` },
      { label: 'Recubrimiento', value: `${formatNumber(input.coverMm / 10, 1)} cm` },
      { label: 'Varilla', value: rebarLabel(input.barDiameterMm) },
      { label: 'f′c', value: kgcm2(draft.fc) },
      { label: 'fy', value: kgcm2(draft.fy) },
    ] },
  ];
}

export function footingReport(result: FootingDesignResult, draft: FootingDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  return {
    element: 'footing',
    title: footingTitle(result),
    tag: draft.tag.trim(),
    place: draft.place.trim(),
    code: result.input.code,
    status: result.status,
    governingRatio: result.governingRatio,
    memo: footingMemo(result),
    checks,
    notes,
    outOfScope: outOfScopeChecks('footing', result.input.code),
    input: result.input,
    data: footingData(result, draft),
    reinforcement: footingReinforcementRows(result),
    values: footingValues(result),
    tables: [],
    takeoff: footingTakeoff(result),
    figures: [
      { title: 'Planta', note: 'Línea discontinua: perímetro crítico de penetración y secciones de cortante como viga', render: () => <FootingPlan result={result} /> },
      { title: 'Corte en X', render: () => <FootingSection result={result} /> },
    ],
  };
}

export function footingReportFromDraft(code: DesignCodeId, draft: FootingDraft) {
  const result = designFooting(footingToInput(code, draft));
  return result.ok ? { ok: true as const, report: footingReport(result, draft) } : { ok: false as const, errors: result.errors };
}
