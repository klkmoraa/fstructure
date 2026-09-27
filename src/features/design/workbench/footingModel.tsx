import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designCombinedFooting, type CombinedFootingInput, type CombinedFootingResult } from '../../../design/elements/combinedFooting';
import { designFooting, type FootingDesignInput, type FootingDesignResult, type FootingDirection } from '../../../design/elements/footing';
import { designStripFooting, type StripFootingInput, type StripFootingResult } from '../../../design/elements/stripFooting';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { combinedFootingTakeoff, footingTakeoff, stripFootingTakeoff } from '../../../design/elements/takeoff';
import { formatNumber, mpaFromKgcm2, parseNumber, splitChecks } from './common';
import type { DesignReport, ReportRow } from './designReport';
import { FootingPlan, FootingSection } from './FootingDrawings';
import { CombinedFootingDiagrams, CombinedFootingPlan, StripFootingSection } from './FootingTypeDrawings';

/** Zapata aislada: del borrador del formulario a la entrada del motor y a la memoria. */
export const FOOTING_DEFAULTS = {
  tag: '', place: '',
  c1: '40', c2: '40', dead: '600', live: '300', group: 'B', seismic: 'no', qa: '150', fc: '250', fy: '4200',
  moments: 'no', mx: '0', my: '60', mux: '0', muy: '85',
  autoPlan: 'yes', sideX: '250', sideY: '250', autoThickness: 'yes', thickness: '50', cover: '7.5', bar: '15.9',
  /** Aislada, corrida bajo muro o combinada de dos columnas. */
  type: 'isolated',
  wallWidth: '20', wallType: 'concrete', wDead: '100', wLive: '50', distBar: '9.5', stripWidth: '100',
  c1x: '40', c1y: '40', p1d: '500', p1l: '200', c2x: '40', c2y: '40', p2d: '800', p2l: '300',
  spacing: '4', edge: 'yes', overhang: '80', combWidth: '250', transBar: '15.9',
};

export type FootingDraft = typeof FOOTING_DEFAULTS;

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

type FootingType = 'isolated' | 'strip' | 'combined';
export const footingType = (draft: FootingDraft): FootingType => draft.type === 'strip' || draft.type === 'combined' ? draft.type : 'isolated';
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
