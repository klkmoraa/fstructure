import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designColumn, type ColumnDesignInput, type ColumnDesignResult } from '../../../design/elements/column';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { columnTakeoff } from '../../../design/elements/takeoff';
import { ColumnSection, InteractionChart } from './ColumnDrawings';
import { formatNumber, mpaFromKgcm2, parseNumber, splitChecks } from './common';
import type { DesignReport, ReportRow } from './designReport';

/** Columna: del borrador del formulario a la entrada del motor y a la memoria. */
export const COLUMN_DEFAULTS = {
  tag: '', place: '',
  width: '40', depth: '40', cover: '4', fc: '250', fy: '4200', bar: '19.1', barsWidth: '3', barsDepth: '3', tie: '9.5',
  axial: '900', momentX: '80', momentY: '40', shearX: '0', shearY: '0', length: '3', k: '1', curvature: 'single', endRatio: '1', sustained: '0.6',
  group: 'B2', groundFloor: 'no', aggregate: '19', braced: 'yes', swayX: '0', swayY: '0', stability: '0.05',
};
type ColumnDraft = typeof COLUMN_DEFAULTS;

export const columnToInput = (codeId: DesignCodeId, draft: ColumnDraft): ColumnDesignInput => ({
  code: codeId,
  widthMm: parseNumber(draft.width) * 10,
  depthMm: parseNumber(draft.depth) * 10,
  coverMm: parseNumber(draft.cover) * 10,
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  barDiameterMm: parseNumber(draft.bar),
  barsAlongWidth: parseNumber(draft.barsWidth),
  barsAlongDepth: parseNumber(draft.barsDepth),
  tieDiameterMm: parseNumber(draft.tie),
  maxAggregateMm: parseNumber(draft.aggregate),
  axialKn: parseNumber(draft.axial),
  momentXKnm: parseNumber(draft.momentX),
  momentYKnm: parseNumber(draft.momentY),
  unbracedLengthM: parseNumber(draft.length),
  effectiveLengthFactor: parseNumber(draft.k),
  curvature: draft.curvature === 'double' ? 'double' : 'single',
  endMomentRatio: parseNumber(draft.endRatio),
  shearXKn: parseNumber(draft.shearX),
  shearYKn: parseNumber(draft.shearY),
  group: draft.group === 'A' || draft.group === 'B1' ? draft.group : 'B2',
  groundFloor: draft.groundFloor === 'yes',
  sustainedRatio: parseNumber(draft.sustained),
  braced: draft.braced !== 'no',
  swayMomentXKnm: draft.braced === 'no' ? parseNumber(draft.swayX) : 0,
  swayMomentYKnm: draft.braced === 'no' ? parseNumber(draft.swayY) : 0,
  stabilityIndex: draft.braced === 'no' ? parseNumber(draft.stability) : 0,
});

export const tieText = (result: ColumnDesignResult) => result.ties.endLengthMm > 0
  ? `E ${rebarLabel(result.ties.diameterMm)} @ ${formatNumber(result.ties.endSpacingMm / 10, 1)} cm en Lo · @ ${formatNumber(result.ties.centerSpacingMm / 10, 1)} cm al centro`
  : `E ${rebarLabel(result.ties.diameterMm)} @ ${formatNumber(result.ties.centerSpacingMm / 10, 1)} cm`;

export const methodLabel: Record<ColumnDesignResult['capacity']['method'], string> = {
  axial: 'Compresión axial',
  'uniaxial-x': 'Flexocompresión en X',
  'uniaxial-y': 'Flexocompresión en Y',
  'bresler-load': 'Biaxial · carga recíproca (Bresler)',
  'bresler-contour': 'Biaxial · contorno de carga',
};

const columnTitle = (result: ColumnDesignResult) => `Columna ${formatNumber(result.input.widthMm / 10, 0)} × ${formatNumber(result.input.depthMm / 10, 0)} cm`;

function columnMemo(result: ColumnDesignResult): string {
  const { input } = result;
  return [
    `COLUMNA ${input.widthMm / 10}×${input.depthMm / 10} cm · ${designCode(input.code).name} · Pu = ${input.axialKn} kN · Mux = ${input.momentXKnm} kN·m · Muy = ${input.momentYKnm} kN·m`,
    ...(input.braced ? [] : [`Marco con desplazamiento lateral: M2s = ${input.swayMomentXKnm} / ${input.swayMomentYKnm} kN·m · Q = ${input.stabilityIndex} · δs = ${formatNumber(Math.max(result.magnification.x.swayFactor, result.magnification.y.swayFactor), 2)}`]),
    `Esbeltez = ${formatNumber(Math.max(result.slenderness.x, result.slenderness.y), 1)} (límite ${formatNumber(result.slenderness.limit, 0)}) · Mc = ${formatNumber(result.magnification.x.designMomentKnm)} / ${formatNumber(result.magnification.y.designMomentKnm)} kN·m (δ ${formatNumber(result.magnification.x.factor, 2)} / ${formatNumber(result.magnification.y.factor, 2)})`,
    `Refuerzo: ${result.bars.length} ${rebarLabel(input.barDiameterMm)} (ρ = ${formatNumber(result.steelRatio * 100, 2)} %)`,
    `Estribos: ${tieText(result)}`,
    `Traslape Clase B: ${formatNumber(result.spliceLengthMm / 10, 0)} cm`,
    `${methodLabel[result.capacity.method]}: ${Math.round(result.capacity.ratio * 100)} % · ${result.capacity.detail}`,
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

function columnReinforcementRows(result: ColumnDesignResult): ReportRow[] {
  return [
    { label: `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} longitudinales`, value: `${result.input.barsAlongWidth} por cara b · ${result.input.barsAlongDepth} por cara h · ρ ${formatNumber(result.steelRatio * 100, 2)} %` },
    { label: 'Estribos', value: `${tieText(result)}${result.ties.endLengthMm > 0 ? ` · Lo = ${formatNumber(result.ties.endLengthMm / 10, 0)} cm` : ''}` },
    { label: 'Grapas por juego', value: `${result.ties.crossTiesParallelToX} paralelas a X · ${result.ties.crossTiesParallelToY} paralelas a Y` },
    { label: 'Traslape Clase B', value: `${formatNumber(result.spliceLengthMm / 10, 0)} cm` },
  ];
}

function columnValues(result: ColumnDesignResult) {
  const code = designCode(result.input.code);
  const slendernessSymbol = code.column.neglectUsesEffectiveLength ? 'kH/r' : 'H/r';
  return [
    { symbol: 'As', label: 'Área de acero', value: `${formatNumber(result.steelAreaMm2 / 100, 2)} cm²` },
    { symbol: 'Grapas', label: 'Por juego', value: String(result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY) },
    { symbol: 'Ag', label: 'Área bruta', value: `${formatNumber(result.grossAreaMm2 / 100, 0)} cm²` },
    { symbol: 'P0', label: 'Axial nominal', value: `${formatNumber(result.squashLoadKn, 0)} kN` },
    { symbol: 'φPn,máx', label: `${code.maximumAxialCoefficient === 1 ? '' : `${code.maximumAxialCoefficient}·`}φ·P0 (φ = ${code.compressionFactor})`, value: `${formatNumber(result.maximumDesignAxialKn, 0)} kN` },
    { symbol: 'emín', label: code.column.minimumMoment === 'eccentricity' ? '0.05h ≥ 20 mm (X / Y)' : '15 + 0.03h si es esbelta (X / Y)', value: `${formatNumber(result.magnification.x.minimumEccentricityMm, 0)} / ${formatNumber(result.magnification.y.minimumEccentricityMm, 0)} mm` },
    { symbol: 'VcR', label: 'Cortante del concreto X / Y', value: `${formatNumber(result.ties.shear.x.concreteStrengthKn, 0)} / ${formatNumber(result.ties.shear.y.concreteStrengthKn, 0)} kN` },
    { symbol: 'Pb · Mb', label: 'Balanceada X', value: `${formatNumber(result.aboutX.balanced.axialKn, 0)} kN · ${formatNumber(result.aboutX.balanced.momentKnm, 0)} kN·m` },
    { symbol: slendernessSymbol, label: `X / Y · límite ${formatNumber(result.slenderness.limit, 0)} (${code.column.radiusNote})`, value: `${formatNumber(result.slenderness.x, 1)} / ${formatNumber(result.slenderness.y, 1)}` },
    { symbol: 'Pc', label: 'Carga crítica X / Y', value: `${formatNumber(result.magnification.x.criticalLoadKn, 0)} / ${formatNumber(result.magnification.y.criticalLoadKn, 0)} kN` },
    { symbol: 'Cm', label: 'Factor de momento', value: formatNumber(result.magnification.x.cm, 2) },
    { symbol: 'M2,mín', label: 'Pu·emín (X)', value: `${formatNumber(result.magnification.x.minimumMomentKnm)} kN·m` },
    { symbol: 'Mc', label: 'Momento de diseño X / Y', value: `${formatNumber(result.magnification.x.designMomentKnm)} / ${formatNumber(result.magnification.y.designMomentKnm)} kN·m` },
    { symbol: 'φ', label: code.axialTransition ? 'Según φPn' : 'Según εt', value: `${code.compressionFactor} → 0.90` },
  ];
}

const kgcm2 = (value: string) => `${value} kg/cm² (${formatNumber(mpaFromKgcm2(value), 1)} MPa)`;

function columnData(result: ColumnDesignResult, draft: ColumnDraft) {
  const { input } = result;
  const code = designCode(input.code);
  return [
    { title: 'Solicitaciones últimas', rows: [
      { label: 'Pu', value: `${formatNumber(input.axialKn, 1)} kN` },
      { label: 'Mux · Muy', value: `${formatNumber(input.momentXKnm, 1)} · ${formatNumber(input.momentYKnm, 1)} kN·m` },
      { label: 'Vux · Vuy', value: `${formatNumber(input.shearXKn, 1)} · ${formatNumber(input.shearYKn, 1)} kN` },
    ] },
    { title: 'Sección y refuerzo', rows: [
      { label: 'Sección', value: `b = ${formatNumber(input.widthMm / 10, 0)} cm (X) · h = ${formatNumber(input.depthMm / 10, 0)} cm (Y)` },
      { label: 'Recubrimiento libre', value: `${formatNumber(input.coverMm / 10, 1)} cm` },
      { label: 'Barras', value: `${rebarLabel(input.barDiameterMm)} · ${input.barsAlongWidth} por cara b · ${input.barsAlongDepth} por cara h` },
      { label: 'Estribo', value: rebarLabel(input.tieDiameterMm) },
      { label: 'Agregado máximo', value: `${formatNumber(input.maxAggregateMm, 0)} mm` },
    ] },
    { title: 'Materiales', rows: [
      { label: 'f′c', value: kgcm2(draft.fc) },
      { label: 'fy', value: kgcm2(draft.fy) },
    ] },
    { title: 'Esbeltez', rows: [
      { label: 'Marco', value: input.braced ? 'sin desplazamiento lateral' : `con desplazamiento lateral · M2s ${formatNumber(input.swayMomentXKnm, 1)} / ${formatNumber(input.swayMomentYKnm, 1)} kN·m · índice ${formatNumber(input.stabilityIndex, 3)}` },
      { label: 'Altura libre · k', value: `${formatNumber(input.unbracedLengthM, 2)} m · k = ${formatNumber(input.effectiveLengthFactor, 2)}` },
      { label: 'Curvatura · |M1/M2|', value: `${input.curvature === 'double' ? 'doble' : 'simple'} · ${formatNumber(input.endMomentRatio, 2)}` },
      { label: 'βdns', value: formatNumber(input.sustainedRatio, 2) },
      ...(code.column.geometryLimits ? [{ label: 'Grupo', value: `${input.group}${input.groundFloor ? ' · planta baja con sismo' : ''}` }] : []),
    ] },
  ];
}

export function columnReport(result: ColumnDesignResult, draft: ColumnDraft): DesignReport {
  const [checks, notes] = splitChecks(result.checks);
  const symmetric = Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth;
  return {
    element: 'column',
    title: columnTitle(result),
    tag: draft.tag.trim(),
    place: draft.place.trim(),
    code: result.input.code,
    status: result.status,
    governingRatio: result.governingRatio,
    memo: columnMemo(result),
    checks,
    notes,
    outOfScope: outOfScopeChecks('column', result.input.code),
    input: result.input,
    data: columnData(result, draft),
    reinforcement: columnReinforcementRows(result),
    values: columnValues(result),
    tables: [],
    takeoff: columnTakeoff(result),
    figures: [
      { title: 'Diagrama de interacción', note: `${methodLabel[result.capacity.method]} · ${symmetric ? 'X = Y' : 'continua X · discontinua Y'} · punteada: nominal`, render: () => <InteractionChart result={result} /> },
      { title: 'Sección', render: () => <ColumnSection result={result} /> },
    ],
  };
}

export function columnReportFromDraft(code: DesignCodeId, draft: ColumnDraft) {
  const result = designColumn(columnToInput(code, draft));
  return result.ok ? { ok: true as const, report: columnReport(result, draft) } : { ok: false as const, errors: result.errors };
}
