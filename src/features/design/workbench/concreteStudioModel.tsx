import { designSectionStudio, type SectionStudioInput, type SectionStudioResult } from '../../../design/concrete/sectionStudio';
import type { DesignCodeId } from '../../../design/elements/codes';
import { complementary, rebarLabel, type ElementCheck } from '../../../design/elements/shared';
import type { Takeoff } from '../../../design/elements/takeoff';
import { ConcreteSectionDrawing, SectionEquilibriumDrawing, SectionInteractionDrawing, SectionLongitudinalDrawing } from './ConcreteStudioDrawings';
import { formatNumber, mpaFromKgcm2, parseNumber } from './common';
import type { DesignReport } from './designReport';

export const SECTION_DEFAULTS = {
  tag: '', place: '', preset: 'column', level: 'simple',
  shape: 'square', width: '40', height: '40', cover: '4',
  fc: '250', fy: '4200', bar: '19.1', barCount: '8', barLayout: 'perimeter', topBarCount: '2', bottomBarCount: '4', cornerBarCount: '1', faceBarCount: '1',
  tie: '9.5', tieType: 'closed', tieSpacing: '15', length: '3',
  philosophy: 'ultimate', demandBasis: 'factored', loadFactor: '1.4',
  axial: '900', moment: '80', shear: '0', angle: '0',
  phi: '0.75', gammaConcrete: '1.5', gammaSteel: '1.15', allowableConcrete: '0.45', allowableSteel: '0.6',
};
export type SectionDraft = typeof SECTION_DEFAULTS;
export type ValidSectionResult = Extract<SectionStudioResult, { status: 'ok' }>;

export const SECTION_SHAPES = [
  { value: 'square', label: 'Cuadrada' }, { value: 'rectangle', label: 'Rectangular' },
  { value: 'circle', label: 'Circular' }, { value: 'octagon', label: 'Octagonal' },
  { value: 'hexagon', label: 'Hexagonal' }, { value: 'triangle', label: 'Triangular' },
] as const;
export const SECTION_PHILOSOPHIES = [
  { value: 'allowable', short: 'EA', label: 'Esfuerzos admisibles', description: 'Esfuerzos elásticos en sección fisurada; solicitaciones de servicio.' },
  { value: 'ultimate', short: 'RU', label: 'Resistencia última', description: 'Resistencia nominal con φ; solicitaciones últimas.' },
  { value: 'limit-state', short: 'EL', label: 'Estados límite', description: 'Resistencias fc/γc y fy/γs; servicio sin evaluar.' },
] as const;
export const SECTION_PRESETS = [
  { value: 'beam', label: 'Flexión de viga' }, { value: 'column', label: 'Columna corta' },
  { value: 'slab', label: 'Franja de losa · 1 m' }, { value: 'pedestal', label: 'Pedestal' },
] as const;

export function sectionPreset(preset: string, current: SectionDraft): SectionDraft {
  if (preset === 'custom') return { ...current, preset: 'custom' };
  const identity = { tag: current.tag, place: current.place, philosophy: current.philosophy, level: current.level };
  const base = { ...SECTION_DEFAULTS, ...identity, preset };
  if (preset === 'beam') return { ...base, shape: 'rectangle', width: '30', height: '55', barLayout: 'layers', topBarCount: '2', bottomBarCount: '4', cover: '3', axial: '0', moment: '90', shear: '40', length: '5' };
  if (preset === 'slab') return { ...base, shape: 'rectangle', width: '100', height: '15', barLayout: 'layers', bar: '9.5', topBarCount: '0', bottomBarCount: '6', cover: '2', axial: '0', moment: '12', shear: '8', length: '4', tie: '7.9', tieSpacing: '15' };
  if (preset === 'pedestal') return { ...base, width: '55', height: '55', barCount: '8', cover: '5', axial: '1100', moment: '30', length: '1' };
  return base;
}

export const sectionPhilosophy = (draft: SectionDraft) => SECTION_PHILOSOPHIES.find((item) => item.value === draft.philosophy) ?? SECTION_PHILOSOPHIES[1];

/** No reinterpretar un borrador corrupto ni permitir que un factor cero borre la carga. */
export function sectionDraftErrors(draft: SectionDraft): string[] {
  const errors: string[] = [];
  if (!SECTION_SHAPES.some((item) => item.value === draft.shape)) errors.push('Selecciona una forma de sección válida.');
  if (!SECTION_PHILOSOPHIES.some((item) => item.value === draft.philosophy)) errors.push('Selecciona una filosofía de cálculo válida.');
  if (!SECTION_PRESETS.some((item) => item.value === draft.preset) && draft.preset !== 'custom') errors.push('Selecciona un tipo de cálculo válido.');
  if (!['simple', 'advanced'].includes(draft.level)) errors.push('Selecciona un nivel de edición válido.');
  if (!['closed', 'cross-tie', 'spiral'].includes(draft.tieType)) errors.push('Selecciona un refuerzo transversal válido.');
  if (!['perimeter', 'layers', 'zones'].includes(draft.barLayout)) errors.push('Selecciona una distribución longitudinal válida.');
  if (draft.barLayout === 'zones') {
    if (!['square', 'rectangle'].includes(draft.shape)) errors.push('Los grupos por zonas sólo se ofrecen en secciones cuadradas o rectangulares.');
    const corner = parseNumber(draft.cornerBarCount); const face = parseNumber(draft.faceBarCount);
    if (!Number.isInteger(corner) || corner < 1 || corner > 3 || !Number.isInteger(face) || face < 0 || face > 3) errors.push('Las zonas requieren 1–3 barras por esquina y 0–3 por cara, en cantidades enteras.');
  }
  if (!['service', 'factored'].includes(draft.demandBasis)) errors.push('Selecciona la base de las solicitaciones.');
  if (draft.philosophy !== 'allowable' && draft.demandBasis === 'service' && (!Number.isFinite(parseNumber(draft.loadFactor)) || parseNumber(draft.loadFactor) < 1)) errors.push('El factor global de demanda debe ser un número mayor o igual que 1.');
  return errors;
}

/** Servicio explícito: sólo RU/EL transforman demandas al pedir un factor global. */
export const sectionInput = (draft: SectionDraft): SectionStudioInput => {
  const philosophy = sectionPhilosophy(draft).value;
  const factor = philosophy !== 'allowable' && draft.demandBasis === 'service' ? parseNumber(draft.loadFactor) : 1;
  return {
    shape: SECTION_SHAPES.find((item) => item.value === draft.shape)?.value ?? 'square',
    philosophy,
    widthMm: parseNumber(draft.width) * 10,
    heightMm: parseNumber(draft.height) * 10,
    coverMm: parseNumber(draft.cover) * 10,
    fcMpa: mpaFromKgcm2(draft.fc), fyMpa: mpaFromKgcm2(draft.fy),
    barDiameterMm: parseNumber(draft.bar), barCount: draft.barLayout === 'zones' ? 4 * (parseNumber(draft.cornerBarCount) + parseNumber(draft.faceBarCount)) : parseNumber(draft.barCount),
    barLayout: draft.barLayout === 'layers' ? 'layers' : draft.barLayout === 'zones' ? 'zones' : 'perimeter',
    topBarCount: parseNumber(draft.topBarCount), bottomBarCount: parseNumber(draft.bottomBarCount),
    cornerBarCount: parseNumber(draft.cornerBarCount), faceBarCount: parseNumber(draft.faceBarCount),
    tieDiameterMm: parseNumber(draft.tie),
    tieType: draft.tieType === 'spiral' ? 'spiral' : draft.tieType === 'cross-tie' ? 'cross-tie' : 'closed',
    tieSpacingMm: parseNumber(draft.tieSpacing) * 10,
    lengthM: parseNumber(draft.length),
    axialKn: parseNumber(draft.axial) * factor, momentKnm: parseNumber(draft.moment) * factor, shearKn: parseNumber(draft.shear) * factor,
    angleDeg: parseNumber(draft.angle), phi: parseNumber(draft.phi),
    gammaConcrete: parseNumber(draft.gammaConcrete), gammaSteel: parseNumber(draft.gammaSteel),
    allowableConcreteRatio: parseNumber(draft.allowableConcrete), allowableSteelRatio: parseNumber(draft.allowableSteel),
  };
};

const shapeLabel = (draft: SectionDraft) => SECTION_SHAPES.find((shape) => shape.value === draft.shape)?.label.toLowerCase() ?? 'cuadrada';
export const sectionTitle = (draft: SectionDraft) => {
  const element = SECTION_PRESETS.find((preset) => preset.value === draft.preset)?.label ?? 'Sección';
  const dimensions = draft.shape === 'circle' ? `Ø ${draft.width} cm` : draft.shape === 'square' ? `${draft.width} × ${draft.width} cm` : `${draft.width} × ${draft.height} cm`;
  return `${element} ${shapeLabel(draft)} · ${dimensions}`;
};

export const sectionStatus = (result: ValidSectionResult): 'fail' | 'warning' => result.utilization > 1 + 1e-6 ? 'fail' : 'warning';
export const sectionHasPerpendicularMoment = (result: ValidSectionResult) => result.directionalOnly;
export const sectionHeadline = (result: ValidSectionResult) => sectionHasPerpendicularMoment(result) ? 'Revisión direccional' : result.utilization > 1 + 1e-6 ? 'Capacidad excedida' : 'Dentro del modelo';
export const sectionVerdict = (result: ValidSectionResult) => `${sectionHeadline(result)} · ${Number.isFinite(result.utilization) ? Math.round(result.utilization * 100) : '>999'} %`;
export const sectionDirectionNote = (result: ValidSectionResult) => `El eje de deformación impuesto genera M⊥ = ${formatNumber(result.analysis.orthogonalMomentKnm, 2)} kN·m ${result.input.philosophy === 'allowable' ? 'en la demanda elástica' : 'en el punto de capacidad'}. Ese momento no fue introducido: la proyección no verifica equilibrio uniaxial ni biaxial.`;

export function sectionTakeoff(result: ValidSectionResult, draft: SectionDraft): Takeoff {
  const { quantities: q, geometry, input } = result;
  return {
    concreteM3: q.concreteM3, steelKg: q.totalSteelKg,
    steelRatioKgM3: q.concreteM3 > 0 ? q.totalSteelKg / q.concreteM3 : 0,
    basis: 'Estimación: barras rectas; estribos y grapas con ganchos de 10 diámetros por extremo; hélice sin vueltas de anclaje. Sin traslapes ni desperdicio; no sustituye un despiece constructivo.',
    lines: [
      { mark: `${geometry.bars.length} longitudinales ${rebarLabel(input.barDiameterMm)}`, diameterMm: input.barDiameterMm, count: geometry.bars.length, pieceLengthM: input.lengthM, massKg: q.longitudinalSteelKg },
      { mark: draft.tieType === 'spiral' ? 'Zuncho continuo' : draft.tieType === 'cross-tie' ? 'Estribos y grapas por juego' : 'Estribos cerrados', diameterMm: input.tieDiameterMm, count: draft.tieType === 'spiral' ? 1 : q.tieCount, pieceLengthM: draft.tieType === 'spiral' ? q.totalTieLengthM : q.tieLengthM, massKg: q.tieSteelKg },
    ],
  };
}

export function sectionReport(result: ValidSectionResult, draft: SectionDraft, code: DesignCodeId): DesignReport {
  const philosophy = sectionPhilosophy(draft);
  const capacityStatus = result.utilization > 1 + 1e-6 ? 'fail' : 'pass';
  const layoutDescription = draft.barLayout === 'layers'
    ? `${draft.topBarCount} superiores · ${draft.bottomBarCount} inferiores`
    : draft.barLayout === 'zones'
      ? `Distribución por zonas experimentales: ${draft.cornerBarCount} por esquina · ${draft.faceBarCount} por cara`
      : 'Distribución perimetral';
  const spacingDescription = draft.barLayout === 'zones'
    ? `Separación libre mínima medida entre todos los pares: ${formatNumber(result.reinforcement.minClearSpacingMm, 1)} mm; criterio geométrico experimental ≥ ${formatNumber(result.reinforcement.requiredClearSpacingMm, 1)} mm. Tres barras por grupo son una opción de acomodo, no un máximo normativo.`
    : `Separación libre mínima entre barras: ${formatNumber(result.reinforcement.minClearSpacingMm, 1)} mm.`;
  const checks: ElementCheck[] = [{
    id: 'section-capacity', label: sectionHasPerpendicularMoment(result) ? 'Proyección N–M · equilibrio perpendicular pendiente' : philosophy.value === 'allowable' ? 'Esfuerzos de la sección fisurada' : 'Axial y flexión en el eje elegido',
    status: sectionHasPerpendicularMoment(result) ? 'warning' : capacityStatus, ratio: result.utilization, reference: complementary(result.analysis.model),
    note: 'Resultado experimental de una sección aislada. La curva no evalúa esbeltez, comportamiento sísmico ni diseño completo del elemento.',
  }, ...result.detailing.checks.filter((check) => check.id !== 'shear').map((check): ElementCheck => ({
    id: `section-${check.id}`, label: check.label, status: check.status === 'ok' ? 'pass' : 'warning',
    reference: complementary('Criterio geométrico experimental'), note: check.description,
  }))];
  const takeoff = sectionTakeoff(result, draft);
  const values = [
    { symbol: 'Ag', label: 'Área de concreto', value: `${formatNumber(result.geometry.areaMm2 / 100, 2)} cm²` },
    { symbol: 'As', label: 'Acero longitudinal', value: `${formatNumber(result.reinforcement.steelAreaMm2 / 100, 2)} cm²` },
    { symbol: 'ρ', label: 'As / Ag', value: `${formatNumber(result.reinforcement.ratioPercent, 2)} %` },
    { symbol: 'N+', label: 'Compresión pura en el modelo', value: `${formatNumber(result.capacity.axialCompressionKn)} kN` },
    { symbol: 'M+', label: 'Flexión pura positiva', value: `${formatNumber(result.capacity.positiveMomentKnm)} kN·m` },
    { symbol: 'M−', label: 'Flexión pura negativa', value: `${formatNumber(result.capacity.negativeMomentKnm)} kN·m` },
    { symbol: 'c', label: 'Eje neutro del punto de capacidad', value: result.analysis.neutralAxisDepthMm === null ? 'Sin eje neutro finito' : `${formatNumber(result.analysis.neutralAxisDepthMm / 10, 2)} cm` },
    { symbol: 'σc', label: 'Máximo esfuerzo del concreto', value: `${formatNumber(result.analysis.maxConcreteStressMpa, 2)} MPa` },
    { symbol: 'σs', label: 'Máximo esfuerzo del acero', value: `${formatNumber(result.analysis.maxSteelStressMpa, 2)} MPa` },
    { symbol: 'N*', label: 'Axial del estado representado', value: `${formatNumber(result.analysis.equilibriumAxialKn)} kN` },
    { symbol: 'M*', label: 'Momento del estado representado', value: `${formatNumber(result.analysis.equilibriumMomentKnm)} kN·m` },
    { symbol: 'M⊥', label: 'Momento perpendicular generado por el eje impuesto', value: `${formatNumber(result.analysis.orthogonalMomentKnm, 2)} kN·m` },
  ];
  return {
    element: 'section', title: sectionTitle(draft), tag: draft.tag.trim(), place: draft.place.trim(), code,
    basisLabel: `${philosophy.short} · ${philosophy.label} · modelo experimental`,
    status: sectionStatus(result), governingRatio: result.utilization,
    memo: [
      sectionTitle(draft), `${philosophy.short} · ${philosophy.label} · ${result.analysis.model}`,
      `Demanda: N = ${formatNumber(result.demand.axialKn)} kN; M = ${formatNumber(result.demand.momentKnm)} kN·m; V = ${formatNumber(result.demand.shearKn)} kN; θ = ${draft.angle}°.`,
      draft.philosophy !== 'allowable' && draft.demandBasis === 'service' ? `Factor global aplicado a la demanda de servicio: ${draft.loadFactor}. No genera combinaciones normativas.` : `Demanda introducida: ${draft.philosophy === 'allowable' ? 'servicio' : 'última'}.`,
      `Refuerzo: ${result.geometry.bars.length} ${rebarLabel(result.input.barDiameterMm)}; As = ${formatNumber(result.reinforcement.steelAreaMm2 / 100, 2)} cm²; recubrimiento libre ${draft.cover} cm.`,
      `Acomodo: ${layoutDescription}. ${spacingDescription}`,
      `Transversal: ${draft.tieType} Ø ${draft.tie} mm @ ${draft.tieSpacing} cm; sugerencia geométrica @ ${formatNumber(result.detailing.proposedTieSpacingMm / 10, 1)} cm.`,
      sectionVerdict(result), ...values.map((row) => `${row.symbol}: ${row.value}.`),
      ...(sectionHasPerpendicularMoment(result) ? [`Advertencia: ${sectionDirectionNote(result)}`] : []),
      `Cuantificación: concreto ${formatNumber(takeoff.concreteM3, 3)} m³; acero ${formatNumber(takeoff.steelKg, 1)} kg.`,
      ...result.assumptions.map((item) => `Hipótesis: ${item}`),
      'FStructure · Cálculo experimental de sección; requiere revisión profesional.',
    ].join('\n'),
    checks, notes: [],
    outOfScope: result.limitations.map((item, index) => ({ id: `section-omission-${index}`, label: item, status: 'out-of-scope', reference: complementary('Fuera del alcance del modelo de sección') })),
    input: { ...result.input, demandBasis: draft.demandBasis, demandLoadFactor: draft.demandBasis === 'service' && draft.philosophy !== 'allowable' ? parseNumber(draft.loadFactor) : 1, preset: draft.preset },
    data: [
      { title: 'Geometría y materiales', rows: [
        { label: 'Forma y dimensiones', value: `${shapeLabel(draft)} · ${formatNumber(result.geometry.widthMm / 10)} × ${formatNumber(result.geometry.heightMm / 10)} cm` },
        { label: 'Acomodo y separación', value: `${layoutDescription} · ${spacingDescription}` },
        { label: 'Longitud de cuantificación', value: `${draft.length} m` },
        { label: 'Recubrimiento libre', value: `${draft.cover} cm` },
        { label: 'f′c / fy', value: `${draft.fc} / ${draft.fy} kg/cm²` },
      ] },
      { title: 'Filosofía y solicitaciones', rows: [
        { label: 'Método', value: `${philosophy.label} · experimental` },
        { label: 'Base de carga', value: draft.philosophy === 'allowable' ? 'Servicio' : draft.demandBasis === 'service' ? `Servicio × ${draft.loadFactor}` : 'Última ingresada directamente' },
        { label: 'N / M / V', value: `${formatNumber(result.demand.axialKn)} kN / ${formatNumber(result.demand.momentKnm)} kN·m / ${formatNumber(result.demand.shearKn)} kN` },
        { label: 'Eje de deformación impuesto', value: `${draft.angle}°` },
        { label: 'Factores del modelo', value: draft.philosophy === 'allowable' ? `σc ≤ ${draft.allowableConcrete} f′c · σs ≤ ${draft.allowableSteel} fy` : draft.philosophy === 'ultimate' ? `φ = ${draft.phi}` : `γc = ${draft.gammaConcrete} · γs = ${draft.gammaSteel}` },
      ] },
    ],
    reinforcement: [
      { label: `${result.geometry.bars.length} barras ${rebarLabel(result.input.barDiameterMm)}`, value: `${layoutDescription} · separación libre mín. ${formatNumber(result.reinforcement.minClearSpacingMm, 1)} mm · ρ = ${formatNumber(result.reinforcement.ratioPercent, 2)} %` },
      { label: 'Refuerzo transversal', value: `${draft.tieType === 'spiral' ? 'Zuncho' : draft.tieType === 'cross-tie' ? 'Cerrado con grapas' : 'Cerrado'} Ø ${draft.tie} @ ${draft.tieSpacing} cm` },
    ],
    values, tables: [{ title: 'Cuantificación geométrica', columns: ['Partida', 'Cantidad', 'Acero'], rows: [
      ['Longitudinales', `${result.geometry.bars.length} × ${draft.length} m`, `${formatNumber(result.quantities.longitudinalSteelKg, 1)} kg`],
      [draft.tieType === 'spiral' ? 'Zuncho' : 'Juegos transversales', `${result.quantities.tieCount}`, `${formatNumber(result.quantities.tieSteelKg, 1)} kg`],
    ] }], takeoff,
    figures: [
      { title: 'Sección y recubrimiento', render: () => <ConcreteSectionDrawing result={result} /> },
      { title: 'Diagrama axial y flexión', note: `${philosophy.short} · θ = ${draft.angle}°`, render: () => <SectionInteractionDrawing result={result} /> },
      { title: 'Deformación y compresión', note: draft.philosophy === 'allowable' ? 'Estado elástico de la demanda' : 'Punto de capacidad sobre la dirección de demanda', render: () => <SectionEquilibriumDrawing result={result} /> },
      { title: 'Distribución longitudinal', render: () => <SectionLongitudinalDrawing result={result} /> },
    ],
  };
}

export function sectionReportFromDraft(code: DesignCodeId, draft: SectionDraft) {
  const errors = sectionDraftErrors(draft);
  if (errors.length) return { ok: false as const, errors };
  const result = designSectionStudio(sectionInput(draft));
  return result.status === 'ok' ? { ok: true as const, report: sectionReport(result, draft, code) } : { ok: false as const, errors: result.errors };
}
