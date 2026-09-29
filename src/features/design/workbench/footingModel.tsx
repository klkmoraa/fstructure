import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designCombinedFooting, type CombinedFootingInput, type CombinedFootingResult } from '../../../design/elements/combinedFooting';
import { designFooting, type FootingDesignInput, type FootingDesignResult, type FootingDirection } from '../../../design/elements/footing';
import { designMatFoundation, type MatFoundationInput, type MatFoundationResult, type MatLayer } from '../../../design/elements/matFoundation';
import { designStrapFooting, type StrapFootingInput, type StrapFootingResult } from '../../../design/elements/strapFooting';
import { designStripFooting, type StripFootingInput, type StripFootingResult } from '../../../design/elements/stripFooting';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { combinedFootingTakeoff, footingTakeoff, matFoundationTakeoff, strapFootingTakeoff, stripFootingTakeoff } from '../../../design/elements/takeoff';
import { formatNumber, mpaFromKgcm2, parseNumber, splitChecks } from './common';
import type { DesignReport, ReportRow } from './designReport';
import { FootingPlan, FootingSection } from './FootingDrawings';
import { CombinedFootingDiagrams, CombinedFootingPlan, StripFootingSection } from './FootingTypeDrawings';
import { MatPlan, MatStripDiagram, StrapDiagrams, StrapFootingPlan } from './FoundationDrawings';

/** Zapata aislada: del borrador del formulario a la entrada del motor y a la memoria. */
export const FOOTING_DEFAULTS = {
  tag: '', place: '',
  colShape: 'rectangular', colDiameter: '45', colFc: '250', pedestal: 'no', pedX: '60', pedY: '60', pedH: '60',
  c1: '40', c2: '40', dead: '600', live: '300', group: 'B', seismic: 'no', qa: '150', fc: '250', fy: '4200',
  moments: 'no', mx: '0', my: '60', mux: '0', muy: '85',
  autoPlan: 'yes', sideX: '250', sideY: '250', autoThickness: 'yes', thickness: '50', cover: '7.5', bar: '15.9',
  /** Aislada, corrida bajo muro o combinada de dos columnas. */
  type: 'isolated',
  wallWidth: '20', wallType: 'concrete', wDead: '100', wLive: '50', distBar: '9.5', stripWidth: '100',
  c1x: '40', c1y: '40', p1d: '500', p1l: '200', c2x: '40', c2y: '40', p2d: '800', p2l: '300',
  spacing: '4', edge: 'yes', overhang: '80', combWidth: '250', transBar: '15.9',
  /** Zapata de lindero con contratrabe. */
  s1x: '40', s1y: '40', s1d: '500', s1l: '200', s2x: '40', s2y: '40', s2d: '800', s2l: '300', strapSpacing: '5',
  strapAuto: 'yes', strapWidth: '45', strapHeight: '80', strapBar: '15.9', strapStirrup: '9.5', b1Auto: 'yes', b1: '170',
  /** Losa de cimentación: retícula, volado y cargas por tipo de columna. */
  nx: '2', sx: '6', ny: '2', sy: '5', matOverhang: '60', mc1: '50', mc2: '50',
  cornerD: '300', cornerL: '150', edgeD: '600', edgeL: '300', interiorD: '1200', interiorL: '600',
};

export type FootingDraft = typeof FOOTING_DEFAULTS;

export const footingToInput = (codeId: DesignCodeId, draft: FootingDraft): FootingDesignInput => {
  const moments = draft.moments === 'yes';
  const code = designCode(codeId);
  const circular = draft.colShape === 'circular';
  return {
    code: codeId,
    columnShape: circular ? 'circular' : 'rectangular',
    columnFcMpa: mpaFromKgcm2(draft.colFc),
    pedestal: draft.pedestal === 'yes' ? { widthMm: parseNumber(draft.pedX) * 10, depthMm: parseNumber(draft.pedY) * 10, heightMm: parseNumber(draft.pedH) * 10 } : null,
    columnWidthMm: parseNumber(circular ? draft.colDiameter : draft.c1) * 10,
    columnDepthMm: parseNumber(circular ? draft.colDiameter : draft.c2) * 10,
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
    `${columnText(input)}${input.pedestal ? ` sobre dado ${input.pedestal.widthMm / 10}×${input.pedestal.depthMm / 10}×${input.pedestal.heightMm / 10} cm` : ''} · P = ${input.deadKn + input.liveKn} kN · Mx = ${input.serviceMomentXKnm} · My = ${input.serviceMomentYKnm} kN·m (servicio)`,
    `Presión de servicio ${formatNumber(result.service.minimumKpa, 0)} a ${formatNumber(result.service.maximumKpa, 0)} kPa · admisible ${input.allowablePressureKpa} kPa`,
    `Refuerzo ${directionTitle(result.directions.x, input.barDiameterMm)} · ${directionTitle(result.directions.y, input.barDiameterMm)}`,
    ...result.bearing.map((item) => `Aplastamiento ${item.label}: Pu = ${formatNumber(item.demandKn, 0)} kN · BR = ${formatNumber(Math.min(item.upperStrengthKn, item.lowerStrengthKn), 0)} kN · barras a través de la interfaz ≥ ${formatNumber(Math.max(item.dowelMinimumMm2, item.dowelExcessMm2) / 100, 2)} cm²`),
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

const footingTitle = (result: FootingDesignResult) => `Zapata ${planText(result)}${result.input.pedestal ? ' con dado' : ''}`;

const columnText = (input: FootingDesignInput) => input.columnShape === 'circular'
  ? `Columna circular Ø ${formatNumber(input.columnWidthMm / 10, 0)} cm`
  : `Columna ${formatNumber(input.columnWidthMm / 10, 0)}×${formatNumber(input.columnDepthMm / 10, 0)} cm`;

function footingReinforcementRows(result: FootingDesignResult): ReportRow[] {
  return [
    ...[result.directions.x, result.directions.y].map((direction) => ({
      label: directionTitle(direction, result.input.barDiameterMm),
      value: directionDetail(direction),
    })),
    ...result.bearing.map((item) => ({
      label: `Barras ${item.label}`,
      value: `As ≥ ${formatNumber(Math.max(item.dowelMinimumMm2, item.dowelExcessMm2) / 100, 2)} cm² a través de la interfaz (0.005Ag${item.dowelExcessMm2 > item.dowelMinimumMm2 ? ', rige el excedente sobre el aplastamiento' : ''})`,
    })),
  ];
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
    ...result.bearing.map((item) => ({ symbol: 'Pu / BR', label: `Aplastamiento ${item.label} (√(A2/A1) = ${formatNumber(Math.min(2, Math.sqrt(item.supportAreaMm2 / item.loadedAreaMm2)), 2)})`, value: `${formatNumber(item.demandKn, 0)} / ${formatNumber(Math.min(item.upperStrengthKn, item.lowerStrengthKn), 0)} kN` })),
    { symbol: 'Mu', label: result.support.circular ? 'Flexión en la sección crítica X · Y' : 'Flexión en el paño X · Y', value: `${formatNumber(result.directions.x.momentKnm, 1)} · ${formatNumber(result.directions.y.momentKnm, 1)} kN·m` },
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
      { label: 'Columna', value: input.columnShape === 'circular'
        ? `circular, D = ${formatNumber(input.columnWidthMm / 10, 0)} cm · f′c ${draft.colFc} kg/cm²`
        : `c1 = ${formatNumber(input.columnWidthMm / 10, 0)} cm (X) · c2 = ${formatNumber(input.columnDepthMm / 10, 0)} cm (Y) · f′c ${draft.colFc} kg/cm²` },
      ...(input.pedestal ? [{ label: 'Dado', value: `${formatNumber(input.pedestal.widthMm / 10, 0)} × ${formatNumber(input.pedestal.depthMm / 10, 0)} cm, altura ${formatNumber(input.pedestal.heightMm / 10, 0)} cm (concreto de la zapata)` }] : []),
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

type FootingType = 'isolated' | 'strip' | 'combined' | 'strap' | 'mat';
export const footingType = (draft: FootingDraft): FootingType =>
  draft.type === 'strip' || draft.type === 'combined' || draft.type === 'strap' || draft.type === 'mat' ? draft.type : 'isolated';
const cmToMm = (value: string) => parseNumber(value) * 10;

// ─── Zapata corrida ───
export const stripToInput = (codeId: DesignCodeId, draft: FootingDraft): StripFootingInput => ({
  code: codeId,
  wallWidthMm: cmToMm(draft.wallWidth),
  wallMaterial: draft.wallType === 'masonry' ? 'masonry' : 'concrete',
  deadKnPerM: parseNumber(draft.wDead),
  liveKnPerM: parseNumber(draft.wLive),
  combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
  allowablePressureKpa: parseNumber(draft.qa),
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  widthMm: draft.autoPlan === 'yes' ? null : cmToMm(draft.stripWidth),
  thicknessMm: draft.autoThickness === 'yes' ? null : cmToMm(draft.thickness),
  coverMm: cmToMm(draft.cover),
  barDiameterMm: parseNumber(draft.bar),
  distributionBarDiameterMm: parseNumber(draft.distBar),
});

const stripTitle = (result: StripFootingResult) => `Zapata corrida B = ${meters(result.widthMm)} m`;

function stripMemo(result: StripFootingResult): string {
  const { input } = result;
  return [
    `ZAPATA CORRIDA B = ${meters(result.widthMm)} m · h = ${formatNumber(result.thicknessMm / 10, 0)} cm · muro de ${input.wallMaterial === 'masonry' ? 'mampostería' : 'concreto'} de ${input.wallWidthMm / 10} cm · ${designCode(input.code).name}`,
    `Cargas por metro: CM = ${input.deadKnPerM} · CV = ${input.liveKnPerM} kN/m · wu = ${formatNumber(result.ultimateLoadKnPerM, 1)} kN/m`,
    `Presión de servicio ${formatNumber(result.servicePressureKpa, 0)} kPa · admisible ${input.allowablePressureKpa} kPa`,
    `Transversal ${rebarLabel(input.barDiameterMm)} @ ${formatNumber(result.transverse.spacingMm / 10, 0)} cm · longitudinal ${result.distribution.barCount} ${rebarLabel(input.distributionBarDiameterMm)}`,
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

function stripReinforcementRows(result: StripFootingResult): ReportRow[] {
  const { input, transverse } = result;
  return [
    { label: `Transversal ${rebarLabel(input.barDiameterMm)} @ ${formatNumber(transverse.spacingMm / 10, 0)} cm`, value: `As ${formatNumber(transverse.providedMm2PerM / 100, 2)} cm²/m (req. ${formatNumber(Math.max(transverse.requiredMm2PerM, transverse.minimumMm2PerM) / 100, 2)})${transverse.anchorage === 'hook' ? ' · con gancho' : ''}` },
    { label: `Longitudinal ${result.distribution.barCount} ${rebarLabel(input.distributionBarDiameterMm)}`, value: `Distribución, @ ${formatNumber(result.distribution.spacingMm / 10, 0)} cm` },
  ];
}

export function stripReport(result: StripFootingResult, draft: FootingDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const { input } = result;
  return {
    element: 'footing', title: stripTitle(result), tag: draft.tag.trim(), place: draft.place.trim(), code: input.code,
    status: result.status, governingRatio: result.governingRatio, memo: stripMemo(result), checks, notes,
    outOfScope: outOfScopeChecks('stripFooting', input.code), input,
    data: [
      { title: 'Muro y cargas (por metro)', rows: [
        { label: 'Muro', value: `${input.wallMaterial === 'masonry' ? 'mampostería' : 'concreto'}, ${formatNumber(input.wallWidthMm / 10, 0)} cm` },
        { label: 'Servicio', value: `CM ${formatNumber(input.deadKnPerM, 1)} · CV ${formatNumber(input.liveKnPerM, 1)} kN/m` },
        { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
        { label: 'Presión admisible neta', value: `${formatNumber(input.allowablePressureKpa, 0)} kPa (del estudio geotécnico)` },
      ] },
      { title: 'Dimensiones y materiales', rows: [
        { label: 'Ancho', value: input.widthMm === null ? `automático → ${meters(result.widthMm)} m` : `${meters(result.widthMm)} m` },
        { label: 'Peralte', value: input.thicknessMm === null ? `automático → ${formatNumber(result.thicknessMm / 10, 0)} cm` : `${formatNumber(result.thicknessMm / 10, 0)} cm` },
        { label: 'Recubrimiento', value: `${formatNumber(input.coverMm / 10, 1)} cm` },
        { label: 'f′c · fy', value: `${draft.fc} · ${draft.fy} kg/cm²` },
      ] },
    ],
    reinforcement: stripReinforcementRows(result),
    values: [
      { symbol: 'B × h', label: 'Dimensiones', value: `${meters(result.widthMm)} m × ${formatNumber(result.thicknessMm / 10, 0)} cm` },
      { symbol: 'd', label: 'Peralte efectivo', value: `${formatNumber(result.effectiveDepthMm / 10, 1)} cm` },
      { symbol: 'q', label: 'Presión de servicio', value: `${formatNumber(result.servicePressureKpa, 0)} kPa` },
      { symbol: 'qu', label: 'Presión última', value: `${formatNumber(result.ultimatePressureKpa, 0)} kPa` },
      { symbol: 'l', label: 'Voladizo a la sección crítica', value: `${formatNumber(result.cantileverMm / 10, 1)} cm` },
      { symbol: 'Mu', label: 'Flexión por metro', value: `${formatNumber(result.momentKnmPerM, 2)} kN·m/m` },
      { symbol: 'Vu / φVc', label: 'Cortante por metro', value: `${formatNumber(result.shearKnPerM, 1)} / ${formatNumber(result.shearStrengthKnPerM, 1)} kN/m` },
      { symbol: 'ld · ldh', label: 'Recta / gancho', value: `${formatNumber(result.transverse.developmentLengthMm / 10, 0)} / ${formatNumber(result.transverse.hookLengthMm / 10, 0)} cm` },
    ],
    tables: [],
    takeoff: stripFootingTakeoff(result),
    figures: [{ title: 'Corte transversal', render: () => <StripFootingSection result={result} /> }],
  };
}

// ─── Zapata combinada ───
export const combinedToInput = (codeId: DesignCodeId, draft: FootingDraft): CombinedFootingInput => ({
  code: codeId,
  columns: [
    { widthMm: cmToMm(draft.c1x), depthMm: cmToMm(draft.c1y), deadKn: parseNumber(draft.p1d), liveKn: parseNumber(draft.p1l) },
    { widthMm: cmToMm(draft.c2x), depthMm: cmToMm(draft.c2y), deadKn: parseNumber(draft.p2d), liveKn: parseNumber(draft.p2l) },
  ],
  spacingMm: parseNumber(draft.spacing) * 1000,
  leftOverhangMm: draft.edge === 'yes' ? null : cmToMm(draft.overhang),
  combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
  allowablePressureKpa: parseNumber(draft.qa),
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  widthMm: draft.autoPlan === 'yes' ? null : cmToMm(draft.combWidth),
  thicknessMm: draft.autoThickness === 'yes' ? null : cmToMm(draft.thickness),
  coverMm: cmToMm(draft.cover),
  longitudinalBarMm: parseNumber(draft.bar),
  transverseBarMm: parseNumber(draft.transBar),
});

const combinedTitle = (result: CombinedFootingResult) => `Zapata combinada ${meters(result.lengthMm)} × ${meters(result.widthMm)} m`;

const layerText = (layer: { barCount: number; spacingMm: number; diameterMm: number }) => `${layer.barCount} ${rebarLabel(layer.diameterMm)} @ ${formatNumber(layer.spacingMm / 10, 0)} cm`;

function combinedMemo(result: CombinedFootingResult): string {
  const { input } = result;
  return [
    `ZAPATA COMBINADA ${meters(result.lengthMm)} × ${meters(result.widthMm)} m · h = ${formatNumber(result.thicknessMm / 10, 0)} cm · ${designCode(input.code).name}`,
    ...input.columns.map((column, index) => `C${index + 1} ${column.widthMm / 10}×${column.depthMm / 10} cm en x = ${meters(result.columnAtMm[index]!)} m · CM ${column.deadKn} · CV ${column.liveKn} kN`),
    `Presión de servicio ${formatNumber(result.service.minimumKpa, 0)} a ${formatNumber(result.service.maximumKpa, 0)} kPa · admisible ${input.allowablePressureKpa} kPa`,
    `Longitudinal inferior ${layerText(result.bottom)}${result.top ? ` · superior ${layerText(result.top)}` : ''}`,
    ...result.bands.map((band) => `Banda bajo C${band.column} (${formatNumber(band.widthMm / 10, 0)} cm): ${layerText(band)}`),
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}${check.ratio !== undefined && Number.isFinite(check.ratio) ? ` (${Math.round(check.ratio * 100)} %)` : ''}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

function combinedReinforcementRows(result: CombinedFootingResult): ReportRow[] {
  const { input } = result;
  return [
    { label: `Inferior ${layerText(result.bottom)}`, value: `Longitudinal · Mu+ ${formatNumber(result.bottom.momentKnm, 0)} kN·m` },
    ...(result.top ? [{ label: `Superior ${layerText(result.top)}`, value: `Longitudinal entre columnas · Mu− ${formatNumber(result.top.momentKnm, 0)} kN·m` }] : []),
    ...result.bands.map((band) => ({ label: `Bajo C${band.column}: ${layerText(band)}`, value: `Transversal en banda de ${formatNumber(band.widthMm / 10, 0)} cm${band.anchorage === 'hook' ? ' · con gancho' : ''}` })),
    { label: `Resto: ${rebarLabel(input.transverseBarMm)} @ ${formatNumber(result.transverseMinimumSpacingMm / 10, 0)} cm`, value: 'Transversal mínimo fuera de las bandas' },
  ];
}

export function combinedReport(result: CombinedFootingResult, draft: FootingDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const { input } = result;
  return {
    element: 'footing', title: combinedTitle(result), tag: draft.tag.trim(), place: draft.place.trim(), code: input.code,
    status: result.status, governingRatio: result.governingRatio, memo: combinedMemo(result), checks, notes,
    outOfScope: outOfScopeChecks('combinedFooting', input.code), input,
    data: [
      { title: 'Columnas', rows: input.columns.map((column, index) => ({
        label: `Columna ${index + 1}`,
        value: `${formatNumber(column.widthMm / 10, 0)} × ${formatNumber(column.depthMm / 10, 0)} cm · CM ${formatNumber(column.deadKn, 0)} · CV ${formatNumber(column.liveKn, 0)} kN · x = ${meters(result.columnAtMm[index]!)} m`,
      })) },
      { title: 'Geometría y suelo', rows: [
        { label: 'Distancia entre ejes', value: `${meters(input.spacingMm)} m` },
        { label: 'Borde izquierdo', value: input.leftOverhangMm === null ? 'al paño exterior de la columna 1 (lindero)' : `a ${formatNumber(input.leftOverhangMm / 10, 0)} cm del eje de la columna 1` },
        { label: 'Planta', value: `${input.widthMm === null ? 'ancho automático → ' : ''}${meters(result.lengthMm)} × ${meters(result.widthMm)} m` },
        { label: 'Peralte', value: input.thicknessMm === null ? `automático → ${formatNumber(result.thicknessMm / 10, 0)} cm` : `${formatNumber(result.thicknessMm / 10, 0)} cm` },
        { label: 'Presión admisible neta', value: `${formatNumber(input.allowablePressureKpa, 0)} kPa (del estudio geotécnico)` },
        { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
        { label: 'f′c · fy', value: `${draft.fc} · ${draft.fy} kg/cm²` },
      ] },
    ],
    reinforcement: combinedReinforcementRows(result),
    values: [
      { symbol: 'L × B × h', label: 'Dimensiones', value: `${meters(result.lengthMm)} × ${meters(result.widthMm)} m · ${formatNumber(result.thicknessMm / 10, 0)} cm` },
      { symbol: 'xR · e', label: 'Resultante de servicio', value: `${meters(result.service.resultantAtMm)} m · e = ${formatNumber(result.service.eccentricityMm / 10, 1)} cm` },
      { symbol: 'q', label: 'Servicio mín · máx', value: `${formatNumber(result.service.minimumKpa, 0)} · ${formatNumber(result.service.maximumKpa, 0)} kPa` },
      { symbol: 'qu', label: 'Última mín · máx', value: `${formatNumber(result.ultimate.minimumKpa, 0)} · ${formatNumber(result.ultimate.maximumKpa, 0)} kPa` },
      { symbol: 'Mu+ · Mu−', label: 'Momentos longitudinales', value: `${formatNumber(result.bottom.momentKnm, 0)} · ${formatNumber(result.top?.momentKnm ?? 0, 0)} kN·m` },
      { symbol: 'Vu / φVc', label: `Cortante a x = ${meters(result.oneWay.atMm)} m`, value: `${formatNumber(result.oneWay.demandKn, 0)} / ${formatNumber(result.oneWay.strengthKn, 0)} kN` },
      ...result.punching.map((item) => ({ symbol: `vu / φvc C${item.column}`, label: `Penetración, ${item.sides} lados, bo = ${formatNumber(item.perimeterMm / 10, 0)} cm`, value: `${formatNumber(item.demandStressMpa, 2)} / ${formatNumber(item.strengthStressMpa, 2)} MPa` })),
      { symbol: 'd', label: 'Peralte efectivo longitudinal', value: `${formatNumber(result.bottom.effectiveDepthMm / 10, 1)} cm` },
    ],
    tables: [],
    takeoff: combinedFootingTakeoff(result),
    figures: [
      { title: 'Planta', note: 'Discontinua: perímetros de penetración; sombra: bandas transversales', render: () => <CombinedFootingPlan result={result} /> },
      { title: 'Cortante y momento a lo largo', note: 'Envolventes últimas; momento positivo con tensión abajo', render: () => <CombinedFootingDiagrams result={result} /> },
    ],
  };
}

export function footingReportFromDraft(code: DesignCodeId, draft: FootingDraft) {
  const type = footingType(draft);
  if (type === 'strap') {
    const result = designStrapFooting(strapToInput(code, draft));
    return result.ok ? { ok: true as const, report: strapReport(result, draft) } : { ok: false as const, errors: result.errors };
  }
  if (type === 'mat') {
    const result = designMatFoundation(matToInput(code, draft));
    return result.ok ? { ok: true as const, report: matReport(result, draft) } : { ok: false as const, errors: result.errors };
  }
  if (type === 'strip') {
    const result = designStripFooting(stripToInput(code, draft));
    return result.ok ? { ok: true as const, report: stripReport(result, draft) } : { ok: false as const, errors: result.errors };
  }
  if (type === 'combined') {
    const result = designCombinedFooting(combinedToInput(code, draft));
    return result.ok ? { ok: true as const, report: combinedReport(result, draft) } : { ok: false as const, errors: result.errors };
  }
  const result = designFooting(footingToInput(code, draft));
  return result.ok ? { ok: true as const, report: footingReport(result, draft) } : { ok: false as const, errors: result.errors };
}

const statusMark = (status: string) => status === 'pass' ? '✓' : status === 'fail' ? '✗' : '!';

// ─── Zapata de lindero con contratrabe ───
export const strapToInput = (codeId: DesignCodeId, draft: FootingDraft): StrapFootingInput => ({
  code: codeId,
  exterior: { widthMm: cmToMm(draft.s1x), depthMm: cmToMm(draft.s1y), deadKn: parseNumber(draft.s1d), liveKn: parseNumber(draft.s1l) },
  interior: { widthMm: cmToMm(draft.s2x), depthMm: cmToMm(draft.s2y), deadKn: parseNumber(draft.s2d), liveKn: parseNumber(draft.s2l) },
  spacingMm: parseNumber(draft.strapSpacing) * 1000,
  combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
  allowablePressureKpa: parseNumber(draft.qa),
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  coverMm: cmToMm(draft.cover),
  exteriorLengthMm: draft.b1Auto === 'yes' ? null : cmToMm(draft.b1),
  thicknessMm: draft.autoThickness === 'yes' ? null : cmToMm(draft.thickness),
  barDiameterMm: parseNumber(draft.bar),
  strap: {
    widthMm: draft.strapAuto === 'yes' ? null : cmToMm(draft.strapWidth),
    heightMm: draft.strapAuto === 'yes' ? null : cmToMm(draft.strapHeight),
    barDiameterMm: parseNumber(draft.strapBar),
    stirrupDiameterMm: parseNumber(draft.strapStirrup),
  },
});

export const strapText = (result: StrapFootingResult) => {
  const { strap } = result;
  return `Contratrabe ${formatNumber(strap.widthMm / 10, 0)} × ${formatNumber(strap.heightMm / 10, 0)} cm`;
};

export function strapReinforcementRows(result: StrapFootingResult): ReportRow[] {
  const { input, strap, exterior, interior } = result;
  return [
    { label: `Contratrabe superior ${strap.top.barCount} ${rebarLabel(input.strap.barDiameterMm)}`, value: `Mu− ${formatNumber(strap.top.momentKnm, 0)} kN·m · gancho en la columna de lindero, corridas a través de la columna 2` },
    { label: `Contratrabe inferior ${strap.bottom.barCount} ${rebarLabel(input.strap.barDiameterMm)}`, value: `Corridas · Mu+ ${formatNumber(strap.bottom.momentKnm, 0)} kN·m` },
    { label: `Estribos ${rebarLabel(input.strap.stirrupDiameterMm)} @ ${formatNumber(strap.shear.spacingMm / 10, 1)} cm`, value: 'Cerrados, en toda la contratrabe' },
    { label: `Zapata 1 ${rebarLabel(input.barDiameterMm)} @ ${formatNumber(exterior.transverse.spacingMm / 10, 0)} cm`, value: `Transversal a la contratrabe · ${exterior.distribution.barCount} ${rebarLabel(input.barDiameterMm)} a lo largo` },
    ...[interior.directions.x, interior.directions.y].map((direction) => ({ label: `Zapata 2 ${directionTitle(direction, input.barDiameterMm)}`, value: directionDetail(direction) })),
  ];
}

export function strapReport(result: StrapFootingResult, draft: FootingDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const { input, exterior, interior, strap } = result;
  const title = `Zapata de lindero ${meters(result.exteriorLengthMm)} × ${meters(result.exteriorWidthMm)} m con contratrabe`;
  return {
    element: 'footing', title, tag: draft.tag.trim(), place: draft.place.trim(), code: input.code,
    status: result.status, governingRatio: result.governingRatio,
    memo: [
      `ZAPATA DE LINDERO CON CONTRATRABE · ${designCode(input.code).name}`,
      `C1 ${input.exterior.widthMm / 10}×${input.exterior.depthMm / 10} cm en el lindero (CM ${input.exterior.deadKn} · CV ${input.exterior.liveKn} kN) · C2 ${input.interior.widthMm / 10}×${input.interior.depthMm / 10} cm (CM ${input.interior.deadKn} · CV ${input.interior.liveKn} kN) · L = ${meters(input.spacingMm)} m`,
      `Zapata 1 ${meters(result.exteriorLengthMm)} × ${meters(result.exteriorWidthMm)} m · h ${formatNumber(exterior.thicknessMm / 10, 0)} cm · e = ${formatNumber(result.eccentricityMm / 10, 1)} cm · R1 = ${formatNumber(result.reactions.service.exteriorKn, 0)} kN`,
      `Zapata 2 ${planText(interior)} · h ${formatNumber(interior.thicknessMm / 10, 0)} cm · R2 = ${formatNumber(result.reactions.service.interiorKn, 0)} kN (diseñada con P2)`,
      `${strapText(result)} · ${strap.top.barCount} ${rebarLabel(input.strap.barDiameterMm)} sup. · ${strap.bottom.barCount} inf. · E ${rebarLabel(input.strap.stirrupDiameterMm)} @ ${formatNumber(strap.shear.spacingMm / 10, 1)} cm`,
      ...result.checks.filter((check) => check.status !== 'info').map((check) => `${statusMark(check.status)} ${check.label}`),
      'FStructure · Diseño experimental; requiere revisión profesional.',
    ].join('\n'),
    checks, notes,
    outOfScope: outOfScopeChecks('strapFooting', input.code), input,
    data: [
      { title: 'Columnas', rows: [
        { label: 'Columna 1 (lindero)', value: `${formatNumber(input.exterior.widthMm / 10, 0)} × ${formatNumber(input.exterior.depthMm / 10, 0)} cm · CM ${formatNumber(input.exterior.deadKn, 0)} · CV ${formatNumber(input.exterior.liveKn, 0)} kN` },
        { label: 'Columna 2 (interior)', value: `${formatNumber(input.interior.widthMm / 10, 0)} × ${formatNumber(input.interior.depthMm / 10, 0)} cm · CM ${formatNumber(input.interior.deadKn, 0)} · CV ${formatNumber(input.interior.liveKn, 0)} kN` },
        { label: 'Distancia entre ejes', value: `${meters(input.spacingMm)} m` },
      ] },
      { title: 'Suelo y materiales', rows: [
        { label: 'Presión admisible neta', value: `${formatNumber(input.allowablePressureKpa, 0)} kPa (del estudio geotécnico)` },
        { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
        { label: 'f′c · fy', value: `${draft.fc} · ${draft.fy} kg/cm²` },
        { label: 'Contratrabe', value: input.strap.widthMm === null ? `automática → ${formatNumber(strap.widthMm / 10, 0)} × ${formatNumber(strap.heightMm / 10, 0)} cm` : `${formatNumber(strap.widthMm / 10, 0)} × ${formatNumber(strap.heightMm / 10, 0)} cm` },
      ] },
    ],
    reinforcement: strapReinforcementRows(result),
    values: [
      { symbol: 'B1 × W1', label: 'Zapata 1', value: `${meters(result.exteriorLengthMm)} × ${meters(result.exteriorWidthMm)} m` },
      { symbol: 'e', label: 'Excentricidad de la zapata 1', value: `${formatNumber(result.eccentricityMm / 10, 1)} cm` },
      { symbol: 'R1 · R2', label: 'Reacciones de servicio', value: `${formatNumber(result.reactions.service.exteriorKn, 0)} · ${formatNumber(result.reactions.service.interiorKn, 0)} kN` },
      { symbol: 'R2,mín', label: 'Columna 2 sólo con muerta', value: `${formatNumber(result.reactions.minimumInteriorKn, 0)} kN` },
      { symbol: 'R1u', label: 'Reacción última de la zapata 1', value: `${formatNumber(result.reactions.ultimate.exteriorKn, 0)} kN` },
      { symbol: 'Mu−', label: `Contratrabe a ${meters(strap.negativeAtMm)} m del lindero`, value: `${formatNumber(strap.top.momentKnm, 0)} kN·m` },
      { symbol: 'Vu / φVn', label: 'Cortante de la contratrabe', value: `${formatNumber(strap.shear.demandKn, 0)} / ${formatNumber(strap.shear.strengthKn, 0)} kN` },
      { symbol: 'd', label: 'Peralte efectivo de la contratrabe', value: `${formatNumber(strap.effectiveDepthMm / 10, 1)} cm` },
    ],
    tables: [],
    takeoff: strapFootingTakeoff(result),
    figures: [
      { title: 'Planta', note: 'Línea de trazo y punto: lindero; sombra: contratrabe', render: () => <StrapFootingPlan result={result} /> },
      { title: 'Contratrabe: cortante y momento', note: 'Del lindero al eje de la columna 2; momento positivo con tensión abajo', render: () => <StrapDiagrams result={result} /> },
    ],
  };
}

// ─── Losa de cimentación ───
export const matToInput = (codeId: DesignCodeId, draft: FootingDraft): MatFoundationInput => ({
  code: codeId,
  spansX: { count: parseNumber(draft.nx), lengthMm: parseNumber(draft.sx) * 1000 },
  spansY: { count: parseNumber(draft.ny), lengthMm: parseNumber(draft.sy) * 1000 },
  overhangMm: cmToMm(draft.matOverhang),
  columnWidthMm: cmToMm(draft.mc1),
  columnDepthMm: cmToMm(draft.mc2),
  loads: {
    corner: { deadKn: parseNumber(draft.cornerD), liveKn: parseNumber(draft.cornerL) },
    edge: { deadKn: parseNumber(draft.edgeD), liveKn: parseNumber(draft.edgeL) },
    interior: { deadKn: parseNumber(draft.interiorD), liveKn: parseNumber(draft.interiorL) },
  },
  combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
  allowablePressureKpa: parseNumber(draft.qa),
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  coverMm: cmToMm(draft.cover),
  barDiameterMm: parseNumber(draft.bar),
  thicknessMm: draft.autoThickness === 'yes' ? null : cmToMm(draft.thickness),
});

const matLayerText = (layer: MatLayer, diameterMm: number) => `${rebarLabel(diameterMm)} @ ${formatNumber(layer.spacingMm / 10, 0)} cm`;

export function matReinforcementRows(result: MatFoundationResult): ReportRow[] {
  const db = result.input.barDiameterMm;
  return (['x', 'y'] as const).flatMap((axis) => (['bottom', 'top'] as const).map((face) => {
    const layer = result.directions[axis][face];
    return {
      label: `${face === 'bottom' ? 'Inferior' : 'Superior'} en ${axis.toUpperCase()}: ${matLayerText(layer, db)}`,
      value: `As ${formatNumber(layer.providedMm2PerM / 100, 2)} cm²/m (req. ${formatNumber(Math.max(layer.requiredMm2PerM, layer.minimumMm2PerM) / 100, 2)}) · Mu ${formatNumber(layer.momentKnmPerM, 1)} kN·m/m`,
    };
  }));
}

const KIND_TEXT = { corner: 'Esquina', edge: 'Borde', interior: 'Interior' } as const;

export function matReport(result: MatFoundationResult, draft: FootingDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const { input } = result;
  const title = `Losa de cimentación ${meters(result.lengthXMm)} × ${meters(result.lengthYMm)} m`;
  return {
    element: 'footing', title, tag: draft.tag.trim(), place: draft.place.trim(), code: input.code,
    status: result.status, governingRatio: result.governingRatio,
    memo: [
      `LOSA DE CIMENTACIÓN ${meters(result.lengthXMm)} × ${meters(result.lengthYMm)} m · h = ${formatNumber(result.thicknessMm / 10, 0)} cm · ${designCode(input.code).name}`,
      `Retícula ${input.spansX.count} × ${meters(input.spansX.lengthMm)} m en X · ${input.spansY.count} × ${meters(input.spansY.lengthMm)} m en Y · volado ${formatNumber(input.overhangMm / 10, 0)} cm · columnas ${input.columnWidthMm / 10}×${input.columnDepthMm / 10} cm`,
      `Presión de servicio ${formatNumber(result.service.pressureKpa, 0)} kPa · admisible ${input.allowablePressureKpa} kPa · qu = ${formatNumber(result.ultimate.pressureKpa, 0)} kPa`,
      ...matReinforcementRows(result).map((row) => row.label),
      ...result.checks.filter((check) => check.status !== 'info').map((check) => `${statusMark(check.status)} ${check.label}`),
      'FStructure · Diseño experimental; requiere revisión profesional.',
    ].join('\n'),
    checks, notes,
    outOfScope: outOfScopeChecks('matFoundation', input.code), input,
    data: [
      { title: 'Retícula y columnas', rows: [
        { label: 'Claros en X', value: `${input.spansX.count} × ${meters(input.spansX.lengthMm)} m` },
        { label: 'Claros en Y', value: `${input.spansY.count} × ${meters(input.spansY.lengthMm)} m` },
        { label: 'Volado desde el eje', value: `${formatNumber(input.overhangMm / 10, 0)} cm` },
        { label: 'Columnas', value: `${formatNumber(input.columnWidthMm / 10, 0)} × ${formatNumber(input.columnDepthMm / 10, 0)} cm` },
        ...(['corner', 'edge', 'interior'] as const).map((kind) => ({ label: `Carga ${KIND_TEXT[kind].toLowerCase()}`, value: `CM ${formatNumber(input.loads[kind].deadKn, 0)} · CV ${formatNumber(input.loads[kind].liveKn, 0)} kN` })),
      ] },
      { title: 'Suelo y materiales', rows: [
        { label: 'Presión admisible neta', value: `${formatNumber(input.allowablePressureKpa, 0)} kPa (del estudio geotécnico)` },
        { label: 'Combinaciones', value: input.combinations.map((combination) => combination.label).join(' · ') },
        { label: 'Espesor', value: input.thicknessMm === null ? `automático → ${formatNumber(result.thicknessMm / 10, 0)} cm` : `${formatNumber(result.thicknessMm / 10, 0)} cm` },
        { label: 'f′c · fy', value: `${draft.fc} · ${draft.fy} kg/cm²` },
      ] },
    ],
    reinforcement: matReinforcementRows(result),
    values: [
      { symbol: 'Lx × Ly × h', label: 'Dimensiones', value: `${meters(result.lengthXMm)} × ${meters(result.lengthYMm)} m · ${formatNumber(result.thicknessMm / 10, 0)} cm` },
      { symbol: 'd', label: 'Peralte efectivo medio', value: `${formatNumber(result.effectiveDepthMm / 10, 1)} cm` },
      { symbol: 'q · qu', label: 'Presión de servicio · última', value: `${formatNumber(result.service.pressureKpa, 0)} · ${formatNumber(result.ultimate.pressureKpa, 0)} kPa` },
      ...result.punching.map((item) => ({ symbol: `vu / φvc`, label: `Penetración ${KIND_TEXT[item.kind].toLowerCase()} (${item.sides} lados, bo ${formatNumber(item.perimeterMm / 10, 0)} cm)`, value: `${formatNumber(item.demandStressMpa, 2)} / ${formatNumber(item.strengthStressMpa, 2)} MPa` })),
      ...(['x', 'y'] as const).map((axis) => ({ symbol: `Vu / φVc ${axis.toUpperCase()}`, label: 'Como viga, por metro', value: `${formatNumber(result.directions[axis].oneWay.demandKnPerM, 0)} / ${formatNumber(result.directions[axis].oneWay.strengthKnPerM, 0)} kN/m` })),
    ],
    tables: [],
    takeoff: matFoundationTakeoff(result),
    figures: [
      { title: 'Planta', note: 'Discontinua: perímetros críticos de penetración', render: () => <MatPlan result={result} /> },
      { title: 'Franja que rige en X', note: 'Momento por metro; positivo con tensión abajo', render: () => <MatStripDiagram result={result} /> },
    ],
  };
}
