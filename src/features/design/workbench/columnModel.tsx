import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designColumn, type ColumnDesignResult } from '../../../design/elements/column';
import { outOfScopeChecks } from '../../../design/elements/scope';
import { rebarLabel } from '../../../design/elements/shared';
import { columnTakeoff } from '../../../design/elements/takeoff';
import { ColumnElevation, ColumnSection, InteractionChart } from './ColumnDrawings';
import { formatNumber, mpaFromKgcm2, splitChecks } from './common';
import { circularDraft, columnToInput, type ColumnDraft } from './columnProposal';
export { COLUMN_DEFAULTS, columnToInput, proposeColumnReinforcement } from './columnProposal';
import type { DesignReport, ReportRow } from './designReport';

/** Conversión pura y adaptador de propuesta también disponibles para el worker. */

export const spacingOriginText = (result: ColumnDesignResult) => result.input.tieSpacingMm !== undefined || result.input.endTieSpacingMm !== undefined
  ? `Separación propia evaluada · propuesta ${formatNumber(result.ties.proposedCenterSpacingMm / 10, 1)} cm${result.ties.endLengthMm > 0 ? ` al centro y ${formatNumber(result.ties.proposedEndSpacingMm / 10, 1)} cm en Lo` : ''}`
  : 'Separación propuesta por resistencia y detallado';

export const tieText = (result: ColumnDesignResult) => result.ties.spiral
  ? `Zuncho ${rebarLabel(result.ties.diameterMm, 'transverse')} a paso de ${formatNumber(result.ties.spiral.pitchMm / 10, 1)} cm`
  : result.ties.endLengthMm > 0
  ? `${tieWord(result)} ${rebarLabel(result.ties.diameterMm, 'transverse')} @ ${formatNumber(result.ties.endSpacingMm / 10, 1)} cm en Lo · @ ${formatNumber(result.ties.centerSpacingMm / 10, 1)} cm al centro`
  : `${tieWord(result)} ${rebarLabel(result.ties.diameterMm, 'transverse')} @ ${formatNumber(result.ties.centerSpacingMm / 10, 1)} cm`;

export const methodLabel: Record<ColumnDesignResult['capacity']['method'], string> = {
  axial: 'Compresión axial',
  'uniaxial-x': 'Flexocompresión en X',
  'uniaxial-y': 'Flexocompresión en Y',
  'bresler-load': 'Biaxial · carga recíproca (Bresler)',
  'bresler-contour': 'Biaxial · contorno de carga',
  resultant: 'Flexocompresión con el momento resultante',
};

const circularResult = (result: ColumnDesignResult) => result.input.shape === 'circular';

const columnTitle = (result: ColumnDesignResult) => circularResult(result)
  ? `Columna circular Ø ${formatNumber(result.input.widthMm / 10, 0)} cm`
  : `Columna ${formatNumber(result.input.widthMm / 10, 0)} × ${formatNumber(result.input.depthMm / 10, 0)} cm`;

/** Estribo circular o rectangular, según la sección. */
const tieWord = (result: ColumnDesignResult) => circularResult(result) ? 'E circular' : 'E';

function columnMemo(result: ColumnDesignResult): string {
  const { input } = result;
  return [
    `${circularResult(result) ? `COLUMNA CIRCULAR Ø ${input.widthMm / 10} cm` : `COLUMNA ${input.widthMm / 10}×${input.depthMm / 10} cm`} · ${designCode(input.code).name} · Pu = ${input.axialKn} kN · Mux = ${input.momentXKnm} kN·m · Muy = ${input.momentYKnm} kN·m`,
    ...(input.braced ? [] : [`Marco con desplazamiento lateral: M2s = ${input.swayMomentXKnm} / ${input.swayMomentYKnm} kN·m · Q = ${input.stabilityIndex} · δs = ${formatNumber(Math.max(result.magnification.x.swayFactor, result.magnification.y.swayFactor), 2)}`]),
    `Esbeltez = ${formatNumber(Math.max(result.slenderness.x, result.slenderness.y), 1)} (límite ${formatNumber(result.slenderness.limit, 0)}) · Mc = ${formatNumber(result.magnification.x.designMomentKnm)} / ${formatNumber(result.magnification.y.designMomentKnm)} kN·m (δ ${formatNumber(result.magnification.x.factor, 2)} / ${formatNumber(result.magnification.y.factor, 2)})`,
    `Refuerzo: ${result.bars.length} ${rebarLabel(input.barDiameterMm)} (ρ = ${formatNumber(result.steelRatio * 100, 2)} %)`,
    `${result.ties.spiral ? 'Refuerzo helicoidal' : 'Estribos'}: ${tieText(result)}${result.ties.spiral ? ` (ρs = ${formatNumber(result.ties.spiral.volumetricRatio * 100, 2)} % ≥ ${formatNumber(result.ties.spiral.requiredRatio * 100, 2)} %)` : ''}`,
    spacingOriginText(result),
    `Traslape Clase B: ${formatNumber(result.spliceLengthMm / 10, 0)} cm`,
    `${methodLabel[result.capacity.method]}: ${Math.round(result.capacity.ratio * 100)} % · ${result.capacity.detail}`,
    ...result.checks.map((check) => `${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'} ${check.label}`),
    'FStructure · Diseño experimental; requiere revisión profesional.',
  ].join('\n');
}

function columnReinforcementRows(result: ColumnDesignResult): ReportRow[] {
  return [
    { label: `${result.bars.length} ${rebarLabel(result.input.barDiameterMm)} longitudinales`, value: `${circularResult(result) ? 'en la circunferencia' : `${result.input.barsAlongWidth} por cara b · ${result.input.barsAlongDepth} por cara h`} · ρ ${formatNumber(result.steelRatio * 100, 2)} %` },
    result.ties.spiral
      ? { label: 'Zuncho', value: `${tieText(result)} · paso libre ${formatNumber(result.ties.spiral.clearPitchMm / 10, 2)} cm · 2.5 vueltas de anclaje en cada extremo` }
      : { label: 'Estribos', value: `${tieText(result)}${result.ties.endLengthMm > 0 ? ` · Lo = ${formatNumber(result.ties.endLengthMm / 10, 0)} cm` : ''}` },
    ...(circularResult(result) ? [] : [{ label: 'Grapas por juego', value: `${result.ties.crossTiesParallelToX} paralelas a X · ${result.ties.crossTiesParallelToY} paralelas a Y` }]),
    { label: 'Origen de la separación', value: spacingOriginText(result) },
    { label: 'Traslape Clase B', value: `${formatNumber(result.spliceLengthMm / 10, 0)} cm` },
  ];
}

function columnValues(result: ColumnDesignResult) {
  const code = designCode(result.input.code);
  const slendernessSymbol = code.column.neglectUsesEffectiveLength ? 'kH/r' : 'H/r';
  const compressionFactor = result.ties.spiral && code.column.spiral ? code.column.spiral.compressionFactor : code.compressionFactor;
  return [
    { symbol: 'As', label: 'Área de acero', value: `${formatNumber(result.steelAreaMm2 / 100, 2)} cm²` },
    { symbol: 's', label: 'Separación propia / propuesta al centro', value: `${formatNumber(result.ties.centerSpacingMm, 1)} / ${formatNumber(result.ties.proposedCenterSpacingMm, 1)} mm` },
    { symbol: 'smáx', label: 'Límite conjunto al centro', value: `${formatNumber(result.ties.maximumCenterSpacingMm, 1)} mm` },
    ...(result.ties.endLengthMm > 0 ? [{ symbol: 'so', label: 'Propia / propuesta / máxima en Lo', value: `${formatNumber(result.ties.endSpacingMm, 1)} / ${formatNumber(result.ties.proposedEndSpacingMm, 1)} / ${formatNumber(result.ties.maximumEndSpacingMm, 1)} mm` }] : []),
    ...(result.ties.spiral ? [
      { symbol: 'Dc', label: 'Núcleo hasta el paño exterior del zuncho', value: `${formatNumber(result.ties.spiral.coreDiameterMm / 10, 1)} cm` },
      { symbol: 'ρs', label: 'Cuantía volumétrica / mínima 0.45(Ag/Ac − 1)f′c/fyt', value: `${formatNumber(result.ties.spiral.volumetricRatio * 100, 2)} / ${formatNumber(result.ties.spiral.requiredRatio * 100, 2)} %` },
      { symbol: 's', label: 'Paso (por cuantía)', value: `${formatNumber(result.ties.spiral.pitchMm, 0)} mm (${formatNumber(result.ties.spiral.ratioPitchMm, 0)} mm)` },
    ] : [{ symbol: 'Grapas', label: 'Por juego', value: String(result.ties.crossTiesParallelToX + result.ties.crossTiesParallelToY) }]),
    { symbol: 'Ag', label: 'Área bruta', value: `${formatNumber(result.grossAreaMm2 / 100, 0)} cm²` },
    { symbol: 'P0', label: 'Axial nominal', value: `${formatNumber(result.squashLoadKn, 0)} kN` },
    { symbol: 'φPn,máx', label: `${code.maximumAxialCoefficient === 1 ? '' : `${code.maximumAxialCoefficient}·`}φ·P0 (φ = ${compressionFactor})`, value: `${formatNumber(result.maximumDesignAxialKn, 0)} kN` },
    { symbol: 'emín', label: code.column.minimumMoment === 'eccentricity' ? '0.05h ≥ 20 mm (X / Y)' : '15 + 0.03h si es esbelta (X / Y)', value: `${formatNumber(result.magnification.x.minimumEccentricityMm, 0)} / ${formatNumber(result.magnification.y.minimumEccentricityMm, 0)} mm` },
    { symbol: 'VcR', label: 'Cortante del concreto X / Y', value: `${formatNumber(result.ties.shear.x.concreteStrengthKn, 0)} / ${formatNumber(result.ties.shear.y.concreteStrengthKn, 0)} kN` },
    { symbol: 'Pb · Mb', label: 'Balanceada X', value: `${formatNumber(result.aboutX.balanced.axialKn, 0)} kN · ${formatNumber(result.aboutX.balanced.momentKnm, 0)} kN·m` },
    { symbol: slendernessSymbol, label: `X / Y · límite ${formatNumber(result.slenderness.limit, 0)} (${code.column.radiusNote})`, value: `${formatNumber(result.slenderness.x, 1)} / ${formatNumber(result.slenderness.y, 1)}` },
    { symbol: 'Pc', label: 'Carga crítica X / Y', value: `${formatNumber(result.magnification.x.criticalLoadKn, 0)} / ${formatNumber(result.magnification.y.criticalLoadKn, 0)} kN` },
    { symbol: 'Cm', label: 'Factor de momento', value: formatNumber(result.magnification.x.cm, 2) },
    { symbol: 'M2,mín', label: 'Pu·emín (X)', value: `${formatNumber(result.magnification.x.minimumMomentKnm)} kN·m` },
    { symbol: 'Mc', label: 'Momento de diseño X / Y', value: `${formatNumber(result.magnification.x.designMomentKnm)} / ${formatNumber(result.magnification.y.designMomentKnm)} kN·m` },
    { symbol: 'φ', label: code.axialTransition ? 'Según φPn' : `Según εt${result.ties.spiral ? ' (columna zunchada)' : ''}`, value: `${compressionFactor} → 0.90` },
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
      { label: 'Sección', value: input.shape === 'circular' ? `circular, D = ${formatNumber(input.widthMm / 10, 0)} cm` : `rectangular, b = ${formatNumber(input.widthMm / 10, 0)} cm (X) · h = ${formatNumber(input.depthMm / 10, 0)} cm (Y)` },
      { label: 'Recubrimiento libre', value: `${formatNumber(input.coverMm / 10, 1)} cm` },
      { label: 'Barras', value: input.shape === 'circular' ? `${input.barCount} ${rebarLabel(input.barDiameterMm)} en la circunferencia` : `${rebarLabel(input.barDiameterMm)} · ${input.barsAlongWidth} por cara b · ${input.barsAlongDepth} por cara h` },
      { label: input.transverse === 'spiral' ? 'Zuncho' : 'Estribo', value: `${input.shape === 'circular' && input.transverse !== 'spiral' ? 'circular ' : ''}${rebarLabel(input.tieDiameterMm, 'transverse')}` },
      { label: 'Separación proporcionada', value: input.tieSpacingMm !== undefined ? `${formatNumber(input.tieSpacingMm / 10, 2)} cm${input.endTieSpacingMm !== undefined ? ` · extremos ${formatNumber(input.endTieSpacingMm / 10, 2)} cm` : ''}` : input.endTieSpacingMm !== undefined ? `Extremos ${formatNumber(input.endTieSpacingMm / 10, 2)} cm; centro propuesto` : 'Automática' },
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
  const symmetric = circularResult(result) || (Math.abs(result.input.widthMm - result.input.depthMm) < 1e-6 && result.input.barsAlongWidth === result.input.barsAlongDepth);
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
      { title: 'Diagrama de interacción', note: `${methodLabel[result.capacity.method]} · ${circularResult(result) ? 'continua: orientación gobernante · discontinua: otra orientación del arreglo' : symmetric ? 'X = Y' : 'continua X · discontinua Y'} · punteada: nominal`, render: () => <InteractionChart result={result} /> },
      { title: 'Sección', render: () => <ColumnSection result={result} /> },
      { title: 'Armado en elevación', note: 'Distribución por zonas; extremos en el paño. Esquema para comparar, no plano de taller.', render: () => <ColumnElevation result={result} /> },
    ],
  };
}

export function columnReportFromDraft(code: DesignCodeId, draft: ColumnDraft) {
  const result = designColumn(columnToInput(code, draft));
  return result.ok ? { ok: true as const, report: columnReport(result, draft) } : { ok: false as const, errors: result.errors };
}

const PROPOSED_BARS = [15.9, 19.1, 22.2, 25.4, 28.6, 31.8];

/**
 * Sección y armado mínimos que cumplen: crece la sección de 5 en 5 cm y, en
 * cada tamaño, prueba diámetros y número de barras hasta el de menor acero que
 * no reprueba nada. Acepta el primer tamaño con cuantía hasta 2.5 %; si ninguno
 * la logra, el primero que cumple.
 */
export function proposeColumn(codeId: DesignCodeId, draft: ColumnDraft): Partial<ColumnDraft> | null {
  const circular = circularDraft(draft);
  const minimum = draft.group === 'B2' ? 25 : 30;
  let fallback: Partial<ColumnDraft> | null = null;
  for (let size = minimum; size <= 120; size += 5) {
    let best: { fields: Partial<ColumnDraft>; steel: number; ratio: number } | null = null;
    for (const bar of PROPOSED_BARS) {
      const counts = circular ? [6, 8, 10, 12, 14, 16, 18, 20] : [2, 3, 4, 5, 6];
      for (const count of counts) {
        const fields: Partial<ColumnDraft> = circular
          ? { diameter: String(size), bar: String(bar), barCount: String(count) }
          : { width: String(size), depth: String(size), bar: String(bar), barsWidth: String(count), barsDepth: String(count) };
        if (bar > 31.8) fields.tie = '12.7';
        const trial = designColumn(columnToInput(codeId, { ...draft, ...fields }));
        if (!trial.ok || trial.status === 'fail') continue;
        if (!best || trial.steelAreaMm2 < best.steel) best = { fields, steel: trial.steelAreaMm2, ratio: trial.steelRatio };
        break;
      }
    }
    if (best) {
      if (best.ratio <= 0.025) return best.fields;
      fallback ??= best.fields;
    }
  }
  return fallback;
}
