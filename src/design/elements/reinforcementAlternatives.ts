import { designColumn, type ColumnDesignInput } from './column';
import { designBeam, type BeamDesignInput } from './beam';
import { designCode, isDesignCodeId } from './codes';
import { designFlexureExercise, type BarGroup, type FlexureExerciseInput, type FlexureExerciseResult } from './flexureExercise';
import { REBAR_SIZES, complementary, type ElementCheck } from './shared';
import { designSectionStudio, proposeSectionReinforcement, type SectionStudioInput } from '../concrete/sectionStudio';
import { layoutBeamBed } from './beamBarLayout';

export interface ArrangementBar { readonly xMm: number; readonly yMm: number; readonly diameterMm: number; readonly layer: number; readonly bed?: 'top' | 'bottom'; readonly kind?: string }
export interface ReinforcementArrangement {
  readonly shape: 'rectangle' | 'circle' | 'polygon';
  readonly distribution: 'tension-bed' | 'beam-beds' | 'column-perimeter' | 'circular-perimeter' | 'experimental-perimeter' | 'experimental-layers' | 'experimental-zones';
  /** Coordinates are section-centred: x right and y up, all in mm. */
  readonly outlinePointsMm?: readonly { readonly xMm: number; readonly yMm: number }[];
  readonly bars: readonly ArrangementBar[];
  readonly beds?: readonly ('top' | 'bottom')[];
  readonly layers: number;
  readonly spacingBasis: 'horizontal-per-layer' | 'minimum-between-bars' | 'engine-minimum-clearance';
  readonly clearSpacingMm: number | null;
  readonly requiredClearSpacingMm: number | null;
  readonly spacingByBed?: readonly { readonly bed: 'top' | 'bottom'; readonly clearSpacingMm: number | null; readonly requiredClearSpacingMm: number; readonly verticalLayerClearSpacingMm: number | null; readonly requiredVerticalLayerClearSpacingMm: number }[];
  readonly verticalLayerClearSpacingMm?: number | null;
  readonly requiredVerticalLayerClearSpacingMm?: number | null;
  /** Every longitudinal bar that will be present after applying this candidate. */
  readonly longitudinalDiametersMm: readonly number[];
  /** Longitudinal runs preserved by the beam engine, such as explicit bastions. */
  readonly longitudinalRuns?: readonly { readonly bed: 'top' | 'bottom'; readonly count: number; readonly diameterMm: number; readonly startM: number; readonly endM: number }[];
}

export type ReinforcementObjective = 'minimum-steel' | 'few-diameters' | 'available-bars';
export interface ReinforcementCandidate {
  readonly id: string;
  readonly geometry: { readonly widthMm: number; readonly heightMm: number };
  readonly reinforcement: { readonly bed: 'top' | 'bottom'; readonly group: BarGroup; readonly diametersMm: readonly number[] };
  readonly arrangement: ReinforcementArrangement;
  readonly checked: { readonly status: 'pass'; readonly checks: readonly ElementCheck[]; readonly excluded: readonly ElementCheck[]; readonly information?: readonly ElementCheck[] };
  readonly steelAreaMm2: number;
  readonly assumedLengthM: number;
  readonly steelWeightKg: number;
  readonly weightAssumption: string;
  readonly display?: string;
  readonly applyFields?: Readonly<Record<string, string>>;
}
export type ReinforcementAlternativesRequest =
  | { readonly kind: 'flexure'; readonly requestId: number; readonly input: FlexureExerciseInput; readonly objective: ReinforcementObjective; readonly availableDiametersMm?: readonly number[] }
  | { readonly kind: 'column'; readonly requestId: number; readonly input: ColumnDesignInput; readonly objective: ReinforcementObjective; readonly availableDiametersMm?: readonly number[] }
  | { readonly kind: 'beam'; readonly requestId: number; readonly input: BeamDesignInput; readonly objective: ReinforcementObjective; readonly availableDiametersMm?: readonly number[] }
  | { readonly kind: 'section'; readonly requestId: number; readonly input: SectionStudioInput; readonly objective: ReinforcementObjective; readonly availableDiametersMm?: readonly number[] };
export interface ReinforcementAlternativesResponse {
  readonly kind: 'alternatives'; readonly requestId: number; readonly candidates: readonly ReinforcementCandidate[];
  readonly reason?: 'empty-stock' | 'no-feasible-candidate';
  readonly error?: 'worker-unavailable' | 'worker-failed';
}

const CATALOG = REBAR_SIZES.map((item) => item.diameterMm).filter(Number.isFinite).sort((a, b) => a - b);
// Keep beam proposals inside the diameter range exposed by the beam editor.
const MINIMUM_BEAM_EDITABLE_DIAMETER_MM = 12.7;
const STEEL_DENSITY_KG_M3 = 7850;
const area = (group: BarGroup) => group.count * Math.PI * group.diameterMm ** 2 / 4;
const uniqueDiameterCount = (candidate: ReinforcementCandidate) => new Set(candidate.arrangement.longitudinalDiametersMm.filter((diameter) => Number.isFinite(diameter) && diameter > 0)).size;
const availableCatalog = (request: { objective: ReinforcementObjective; availableDiametersMm?: readonly number[] }) => {
  if (request.objective !== 'available-bars') return { values: CATALOG, empty: false };
  const values = [...new Set(request.availableDiametersMm ?? [])].filter((diameter) => CATALOG.includes(diameter)).sort((a, b) => a - b);
  return { values, empty: values.length === 0 };
};
const resultChecks = (checks: readonly ElementCheck[]) => ({
  checks: checks.filter((check) => check.status !== 'out-of-scope' && check.status !== 'info'),
  excluded: checks.filter((check) => check.status === 'out-of-scope'),
  information: checks.filter((check) => check.status === 'info'),
});
const acceptedChecks = (checks: readonly ElementCheck[]) => {
  const evaluated = resultChecks(checks).checks;
  return evaluated.length > 0 && evaluated.every((check) => check.status === 'pass');
};
const finish = (requestId: number, candidates: readonly ReinforcementCandidate[]): ReinforcementAlternativesResponse => {
  const unique = new Map<string, ReinforcementCandidate>();
  for (const candidate of candidates) unique.set(candidate.id, candidate);
  const output = [...unique.values()].slice(0, 3);
  return { kind: 'alternatives', requestId, candidates: output, ...(output.length ? {} : { reason: 'no-feasible-candidate' as const }) };
};
const rank = (candidates: readonly ReinforcementCandidate[], objective: ReinforcementObjective) => [...candidates].sort((a, b) =>
  (objective === 'few-diameters' ? uniqueDiameterCount(a) - uniqueDiameterCount(b) : 0)
  || a.steelAreaMm2 - b.steelAreaMm2 || a.id.localeCompare(b.id));

const actualClearSpacing = (bars: readonly ArrangementBar[], pairMode: 'same-layer' | 'different-layers' | 'all' = 'same-layer'): number | null => {
  let minimum = Number.POSITIVE_INFINITY;
  for (let i = 0; i < bars.length; i += 1) for (let j = i + 1; j < bars.length; j += 1) {
    const first = bars[i]!; const second = bars[j]!;
    if (pairMode === 'same-layer' && (first.layer !== second.layer || first.bed !== second.bed)) continue;
    if (pairMode === 'different-layers' && (first.layer === second.layer || first.bed !== second.bed)) continue;
    minimum = Math.min(minimum, Math.hypot(first.xMm - second.xMm, first.yMm - second.yMm) - (first.diameterMm + second.diameterMm) / 2);
  }
  return Number.isFinite(minimum) ? minimum : null;
};
const diameters = (group: BarGroup) => Array.from({ length: Math.max(0, group.count) }, () => group.diameterMm);
const toBars = (placements: readonly { readonly xMm: number; readonly fromFaceMm: number; readonly diameterMm: number; readonly layer: number; readonly kind?: string }[], widthMm: number, heightMm: number, bed: 'top' | 'bottom'): ArrangementBar[] => placements.map((bar) => ({
  xMm: bar.xMm - widthMm / 2,
  yMm: bed === 'top' ? heightMm / 2 - bar.fromFaceMm : -heightMm / 2 + bar.fromFaceMm,
  diameterMm: bar.diameterMm, layer: bar.layer, bed, ...(bar.kind ? { kind: bar.kind } : {}),
}));
const rectOutline = (widthMm: number, heightMm: number): ReinforcementArrangement['outlinePointsMm'] => [
  { xMm: -widthMm / 2, yMm: -heightMm / 2 }, { xMm: widthMm / 2, yMm: -heightMm / 2 },
  { xMm: widthMm / 2, yMm: heightMm / 2 }, { xMm: -widthMm / 2, yMm: heightMm / 2 },
];

/** Worker entry point. Every candidate is passed through its domain engine with fixed actions and geometry. */
export function reinforcementAlternatives(request: ReinforcementAlternativesRequest): ReinforcementAlternativesResponse {
  switch (request.kind) {
    case 'flexure': return flexureAlternatives(request);
    case 'column': return columnAlternatives(request);
    case 'beam': return beamAlternatives(request);
    case 'section': return sectionAlternatives(request);
  }
}

function flexureAlternatives(request: Extract<ReinforcementAlternativesRequest, { kind: 'flexure' }>): ReinforcementAlternativesResponse {
  const { requestId, input } = request;
  if (!isDesignCodeId(input.code) || ![input.widthMm, input.heightMm, input.coverMm, input.fcMpa, input.fyMpa, input.stirrupDiameterMm, input.aggregateMm, input.momentKnM].every(Number.isFinite)
    || input.widthMm <= 0 || input.heightMm <= 0 || input.coverMm < 0 || input.fcMpa <= 0 || input.fyMpa <= 0 || input.stirrupDiameterMm <= 0 || input.aggregateMm < 0) {
    return { kind: 'alternatives', requestId, candidates: [], reason: 'no-feasible-candidate' };
  }
  const available = availableCatalog(request);
  if (available.empty) return { kind: 'alternatives', requestId, candidates: [], reason: 'empty-stock' };
  const bed = input.momentKnM < 0 ? 'top' : 'bottom';
  const trials: { group: BarGroup; result: FlexureExerciseResult }[] = [];
  const maxBars = Math.min(16, Math.max(2, Math.floor(input.widthMm / 18)));
  for (const diameterMm of available.values) for (let count = 2; count <= maxBars; count += 1) {
    const group = { count, diameterMm };
    const result = designFlexureExercise({ ...input, [bed]: group });
    if (acceptedChecks(result.checks)) trials.push({ group, result });
  }
  trials.sort((a, b) => area(a.group) - area(b.group) || a.group.diameterMm - b.group.diameterMm || a.group.count - b.group.count);
  const output = trials.map(({ group, result }): ReinforcementCandidate => {
    const checks = resultChecks(result.checks);
    const steelAreaMm2 = area(group);
    const assumedLengthM = 1;
    const placements = result.layout.bars ?? [];
    const bars = toBars(placements, input.widthMm, input.heightMm, bed);
    return { id: `${bed}-${group.count}x${group.diameterMm}`, geometry: { widthMm: input.widthMm, heightMm: input.heightMm },
      reinforcement: { bed, group, diametersMm: bars.map((bar) => bar.diameterMm) },
      arrangement: { shape: 'rectangle', distribution: 'tension-bed', outlinePointsMm: rectOutline(input.widthMm, input.heightMm), bars, beds: [bed], layers: Math.max(1, ...bars.map((bar) => bar.layer)), spacingBasis: 'horizontal-per-layer',
        clearSpacingMm: actualClearSpacing(bars), requiredClearSpacingMm: designCode(input.code).beam.minimumClearSpacing(group.diameterMm, input.aggregateMm), longitudinalDiametersMm: bars.map((bar) => bar.diameterMm) },
      checked: { status: 'pass', ...checks }, steelAreaMm2,
      assumedLengthM, steelWeightKg: steelAreaMm2 * assumedLengthM * 1e-6 * STEEL_DENSITY_KG_M3,
      weightAssumption: 'Barras longitudinales: 1 m por lecho; estribos y anclajes excluidos.',
      display: `${group.count} × Ø ${group.diameterMm} mm · ${bed === 'top' ? 'lecho superior' : 'lecho inferior'}`,
      applyFields: { [bed === 'top' ? 'topCount' : 'bottomCount']: String(group.count), [bed === 'top' ? 'topBar' : 'bottomBar']: String(group.diameterMm) },
    };
  });
  return finish(requestId, output);
}

function columnAlternatives(request: Extract<ReinforcementAlternativesRequest, { kind: 'column' }>): ReinforcementAlternativesResponse {
  const { requestId, input, objective } = request;
  const available = availableCatalog(request);
  if (available.empty) return { kind: 'alternatives', requestId, candidates: [], reason: 'empty-stock' };
  const candidates: ReinforcementCandidate[] = [];
  for (const diameter of available.values) for (let widthCount = 2; widthCount <= (input.shape === 'circular' ? 20 : 8); widthCount += 1) for (let depthCount = 2; depthCount <= (input.shape === 'circular' ? 2 : 8); depthCount += 1) {
    const trialInput: ColumnDesignInput = { ...input, barDiameterMm: diameter,
      ...(input.shape === 'circular' ? { barCount: Math.max(4, widthCount * 2) } : { barsAlongWidth: widthCount, barsAlongDepth: depthCount }) };
    const result = designColumn(trialInput);
    if (!result.ok || result.status === 'fail' || !acceptedChecks(result.checks)) continue;
    const count = result.bars.length;
    const steelAreaMm2 = result.steelAreaMm2;
    const assumedLengthM = input.unbracedLengthM;
    const checks = resultChecks(result.checks);
    const spacing = result.checks.find((check) => check.id === 'bar-spacing');
    const arrangementBars = result.bars.map((bar) => ({ xMm: bar.x, yMm: bar.y, diameterMm: diameter, layer: 1 }));
    const sectionHeightMm = input.shape === 'circular' ? input.widthMm : input.depthMm;
    candidates.push({ id: `column-${diameter}-${widthCount}-${depthCount}`, geometry: { widthMm: input.widthMm, heightMm: sectionHeightMm },
      reinforcement: { bed: 'top', group: { count, diameterMm: diameter }, diametersMm: result.bars.map(() => diameter) },
      arrangement: { shape: input.shape === 'circular' ? 'circle' : 'rectangle', distribution: input.shape === 'circular' ? 'circular-perimeter' : 'column-perimeter', ...(input.shape === 'circular' ? {} : { outlinePointsMm: rectOutline(input.widthMm, input.depthMm) }),
        bars: arrangementBars, layers: 1, spacingBasis: 'minimum-between-bars', clearSpacingMm: spacing?.capacity ?? null, requiredClearSpacingMm: spacing?.demand ?? null,
        longitudinalDiametersMm: result.bars.map(() => diameter) },
      checked: { status: 'pass', ...checks }, steelAreaMm2, assumedLengthM,
      steelWeightKg: steelAreaMm2 * assumedLengthM * 1e-6 * STEEL_DENSITY_KG_M3,
      weightAssumption: `Barras longitudinales sobre lu=${assumedLengthM} m; estribos, traslapes y desperdicio excluidos.`,
      display: `${count} × Ø ${diameter} mm · ${input.shape === 'circular' ? 'circular' : `${widthCount} × ${depthCount} barras por cara`}`,
      applyFields: input.shape === 'circular' ? { bar: String(diameter), barCount: String(trialInput.barCount) } : { bar: String(diameter), barsWidth: String(widthCount), barsDepth: String(depthCount) },
    });
  }
  return finish(requestId, rank(candidates, objective));
}

function beamAlternatives(request: Extract<ReinforcementAlternativesRequest, { kind: 'beam' }>): ReinforcementAlternativesResponse {
  const { requestId, input, objective } = request;
  const available = availableCatalog(request);
  if (available.empty) return { kind: 'alternatives', requestId, candidates: [], reason: 'empty-stock' };
  const editableDiameters = available.values.filter((diameter) => diameter >= MINIMUM_BEAM_EDITABLE_DIAMETER_MM);
  if (editableDiameters.length === 0) return { kind: 'alternatives', requestId, candidates: [], reason: 'no-feasible-candidate' };
  if (!input.provided) return { kind: 'alternatives', requestId, candidates: [], reason: 'no-feasible-candidate' };
  const candidates: ReinforcementCandidate[] = [];
  for (const diameter of editableDiameters) for (let count = 2; count <= 8; count += 1) for (const bed of ['top', 'bottom'] as const) {
    const provided = { ...input.provided, [bed]: { count, diameterMm: diameter } };
    const result = designBeam({ ...input, provided });
    if (!result.ok || result.status === 'fail' || !acceptedChecks(result.checks)) continue;
    const topGroup = provided.top;
    const bottomGroup = provided.bottom;
    const bastions = provided.bastions === 'custom' ? provided.customBastions ?? []
      : provided.bastions === 'auto' ? result.bastions.map((bastion) => ({ bed: bastion.bed, count: bastion.bars.count,
        diameterMm: bastion.bars.diameterMm, startM: bastion.startM, endM: bastion.endM })) : [];
    const bastionGroups = bastions.map((bastion) => ({ count: bastion.count, diameterMm: bastion.diameterMm }));
    const appliedGroups = [topGroup, bottomGroup, ...bastionGroups];
    const longitudinalDiametersMm = appliedGroups.flatMap(diameters);
    const steelAreaMm2 = appliedGroups.reduce((sum, group) => sum + area(group), 0);
    const assumedLengthM = input.spans.reduce((sum, span) => sum + span.lengthM, 0);
    const topLayout = layoutBeamBed({ widthMm: input.widthMm, heightMm: input.heightMm, coverMm: input.coverMm,
      stirrupDiameterMm: result.stirrupDiameterMm, minimumClearSpacingMm: result.continuousTop.minimumClearSpacingMm,
      continuous: result.continuousTop.continuous, extra: result.continuousTop.extra });
    const bottomLayout = layoutBeamBed({ widthMm: input.widthMm, heightMm: input.heightMm, coverMm: input.coverMm,
      stirrupDiameterMm: result.stirrupDiameterMm, minimumClearSpacingMm: result.continuousBottom.minimumClearSpacingMm,
      continuous: result.continuousBottom.continuous, extra: result.continuousBottom.extra });
    if (!topLayout || !bottomLayout) continue;
    const topBars = toBars(topLayout, input.widthMm, input.heightMm, 'top');
    const bottomBars = toBars(bottomLayout, input.widthMm, input.heightMm, 'bottom');
    const bars = [...topBars, ...bottomBars];
    const steelWeightKg = (area(topGroup) + area(bottomGroup)) * assumedLengthM * 1e-6 * STEEL_DENSITY_KG_M3
      + bastions.reduce((sum, bastion) => sum + area({ count: bastion.count, diameterMm: bastion.diameterMm }) * Math.max(0, bastion.endM - bastion.startM) * 1e-6 * STEEL_DENSITY_KG_M3, 0);
    const checks = resultChecks(result.checks);
    candidates.push({ id: `beam-${bed}-${count}-${diameter}`, geometry: { widthMm: input.widthMm, heightMm: input.heightMm },
      reinforcement: { bed, group: { count, diameterMm: diameter }, diametersMm: longitudinalDiametersMm },
      arrangement: { shape: 'rectangle', distribution: 'beam-beds', outlinePointsMm: rectOutline(input.widthMm, input.heightMm), bars, beds: ['top', 'bottom'], spacingBasis: 'horizontal-per-layer',
        layers: Math.max(result.continuousTop.layers, result.continuousBottom.layers),
        clearSpacingMm: null, requiredClearSpacingMm: null,
        spacingByBed: [
          { bed: 'top', clearSpacingMm: actualClearSpacing(topBars), requiredClearSpacingMm: result.continuousTop.minimumClearSpacingMm,
            verticalLayerClearSpacingMm: actualClearSpacing(topBars, 'different-layers'), requiredVerticalLayerClearSpacingMm: Math.max(25, ...topBars.map((bar) => bar.diameterMm)) },
          { bed: 'bottom', clearSpacingMm: actualClearSpacing(bottomBars), requiredClearSpacingMm: result.continuousBottom.minimumClearSpacingMm,
            verticalLayerClearSpacingMm: actualClearSpacing(bottomBars, 'different-layers'), requiredVerticalLayerClearSpacingMm: Math.max(25, ...bottomBars.map((bar) => bar.diameterMm)) },
        ],
        longitudinalDiametersMm, longitudinalRuns: bastions.map((bastion) => ({ bed: bastion.bed, count: bastion.count,
          diameterMm: bastion.diameterMm, startM: bastion.startM, endM: bastion.endM })) },
      checked: { status: 'pass', ...checks }, steelAreaMm2, assumedLengthM,
      steelWeightKg,
      weightAssumption: `Área total de ambos lechos continuos sobre ${assumedLengthM} m y bastones longitudinales conservados sobre sus tramos; estribos, anclajes y desperdicio excluidos.`,
      display: `${bed === 'top' ? 'Superior' : 'Inferior'} · ${count} × Ø ${diameter} mm`,
      applyFields: bed === 'top' ? { rebarMode: 'own', topCount: String(count), topBar: String(diameter) } : { rebarMode: 'own', bottomCount: String(count), bottomBar: String(diameter) },
    });
  }
  return finish(requestId, rank(candidates, objective));
}

function sectionAlternatives(request: Extract<ReinforcementAlternativesRequest, { kind: 'section' }>): ReinforcementAlternativesResponse {
  const { requestId, input, objective } = request;
  const available = availableCatalog(request);
  if (available.empty) return { kind: 'alternatives', requestId, candidates: [], reason: 'empty-stock' };
  const candidates: ReinforcementCandidate[] = [];
  for (const diameter of available.values) {
    const proposal = proposeSectionReinforcement(input, { diametersMm: [diameter] });
    if (proposal.status !== 'proposed') continue;
    const result = designSectionStudio(proposal.input);
    if (result.status !== 'ok' || result.directionalOnly || result.utilization > 1 || result.reinforcement.minClearSpacingMm < result.reinforcement.requiredClearSpacingMm) continue;
    const steelAreaMm2 = result.reinforcement.steelAreaMm2;
    const checks: ElementCheck[] = [
      { id: 'experimental-nm', label: 'Resistencia N–M experimental', status: 'pass', reference: complementary('Motor experimental de sección'), demand: 1, capacity: result.utilization },
      { id: 'experimental-spacing', label: 'Separación libre experimental', status: 'pass', reference: complementary('Regla geométrica del motor'), demand: result.reinforcement.requiredClearSpacingMm, capacity: result.reinforcement.minClearSpacingMm },
    ];
    const excluded = result.limitations.map((limitation, index): ElementCheck => ({ id: `scope-${index}`, label: limitation, status: 'out-of-scope', reference: complementary('Alcance Experimental') }));
    const assumedLengthM = input.lengthM;
    const arrangementBars = result.geometry.bars.map((bar) => ({ xMm: bar.x, yMm: bar.y, diameterMm: diameter,
      layer: input.barLayout === 'layers' && bar.y < 0 ? 2 : 1 }));
    const shape = input.shape === 'circle' ? 'circle' : input.shape === 'square' || input.shape === 'rectangle' ? 'rectangle' : 'polygon';
    candidates.push({ id: `section-${diameter}-${result.reinforcement.barCount}`, geometry: { widthMm: result.geometry.widthMm, heightMm: result.geometry.heightMm },
      reinforcement: { bed: 'top', group: { count: result.reinforcement.barCount, diameterMm: diameter }, diametersMm: result.geometry.bars.map(() => diameter) },
      arrangement: { shape, distribution: input.barLayout === 'layers' ? 'experimental-layers' : input.barLayout === 'zones' ? 'experimental-zones' : 'experimental-perimeter', ...(shape !== 'circle' ? { outlinePointsMm: result.geometry.vertices.map((point) => ({ xMm: point.x, yMm: point.y })) } : {}),
        bars: arrangementBars, layers: Math.max(1, ...arrangementBars.map((bar) => bar.layer)),
        spacingBasis: 'engine-minimum-clearance',
        clearSpacingMm: result.reinforcement.minClearSpacingMm, requiredClearSpacingMm: result.reinforcement.requiredClearSpacingMm,
        longitudinalDiametersMm: result.geometry.bars.map(() => diameter) },
      checked: { status: 'pass', checks, excluded }, steelAreaMm2, assumedLengthM,
      steelWeightKg: steelAreaMm2 * assumedLengthM * 1e-6 * STEEL_DENSITY_KG_M3,
      weightAssumption: `Estimación de barras longitudinales sobre longitud ${assumedLengthM} m; estribos, traslapes y anclajes excluidos.`,
      display: `Experimental · ${result.reinforcement.barCount} × Ø ${diameter} mm · utilización ${result.utilization.toFixed(3)}`,
      applyFields: { bar: String(diameter), barCount: String(result.reinforcement.barCount),
        ...(input.barLayout === 'layers' ? { topBarCount: String(result.input.topBarCount), bottomBarCount: String(result.input.bottomBarCount) } : {}),
        ...(input.barLayout === 'zones' ? { cornerBarCount: String(result.input.cornerBarCount), faceBarCount: String(result.input.faceBarCount) } : {}) },
    });
  }
  return finish(requestId, rank(candidates, objective));
}
