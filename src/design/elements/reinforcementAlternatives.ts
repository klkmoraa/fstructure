import { designColumn, type ColumnDesignInput } from './column';
import { designBeam, type BeamDesignInput } from './beam';
import { isDesignCodeId } from './codes';
import { designFlexureExercise, type BarGroup, type FlexureExerciseInput, type FlexureExerciseResult } from './flexureExercise';
import { REBAR_SIZES, complementary, type ElementCheck } from './shared';
import { designSectionStudio, proposeSectionReinforcement, type SectionStudioInput } from '../concrete/sectionStudio';

export type ReinforcementObjective = 'minimum-steel' | 'few-diameters' | 'available-bars';
export interface ReinforcementCandidate {
  readonly id: string;
  readonly geometry: { readonly widthMm: number; readonly heightMm: number };
  readonly reinforcement: { readonly bed: 'top' | 'bottom'; readonly group: BarGroup; readonly diametersMm: readonly number[] };
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
const STEEL_DENSITY_KG_M3 = 7850;
const area = (group: BarGroup) => group.count * Math.PI * group.diameterMm ** 2 / 4;
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
  (objective === 'few-diameters' ? a.reinforcement.group.count - b.reinforcement.group.count : a.steelAreaMm2 - b.steelAreaMm2)
  || a.steelAreaMm2 - b.steelAreaMm2 || a.id.localeCompare(b.id));

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
  const { requestId, input, objective } = request;
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
  trials.sort((a, b) => (objective === 'few-diameters' ? a.group.count - b.group.count : area(a.group) - area(b.group))
    || area(a.group) - area(b.group) || a.group.diameterMm - b.group.diameterMm || a.group.count - b.group.count);
  const output = trials.map(({ group, result }): ReinforcementCandidate => {
    const checks = resultChecks(result.checks);
    const steelAreaMm2 = area(group);
    const assumedLengthM = 1;
    return { id: `${bed}-${group.count}x${group.diameterMm}`, geometry: { widthMm: input.widthMm, heightMm: input.heightMm },
      reinforcement: { bed, group, diametersMm: result.layout.bars?.map((bar) => bar.diameterMm) ?? [] }, checked: { status: 'pass', ...checks }, steelAreaMm2,
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
    candidates.push({ id: `column-${diameter}-${widthCount}-${depthCount}`, geometry: { widthMm: input.widthMm, heightMm: input.depthMm },
      reinforcement: { bed: 'top', group: { count, diameterMm: diameter }, diametersMm: result.bars.map(() => diameter) },
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
  if (!input.provided) return { kind: 'alternatives', requestId, candidates: [], reason: 'no-feasible-candidate' };
  const candidates: ReinforcementCandidate[] = [];
  for (const diameter of available.values) for (let count = 2; count <= 8; count += 1) for (const bed of ['top', 'bottom'] as const) {
    const provided = { ...input.provided, [bed]: { count, diameterMm: diameter } };
    const result = designBeam({ ...input, provided });
    if (!result.ok || result.status === 'fail' || !acceptedChecks(result.checks)) continue;
    const steelAreaMm2 = area({ count, diameterMm: diameter });
    const assumedLengthM = input.spans.reduce((sum, span) => sum + span.lengthM, 0);
    const checks = resultChecks(result.checks);
    candidates.push({ id: `beam-${bed}-${count}-${diameter}`, geometry: { widthMm: input.widthMm, heightMm: input.heightMm },
      reinforcement: { bed, group: { count, diameterMm: diameter }, diametersMm: Array.from({ length: count }, () => diameter) },
      checked: { status: 'pass', ...checks }, steelAreaMm2, assumedLengthM,
      steelWeightKg: steelAreaMm2 * assumedLengthM * 1e-6 * STEEL_DENSITY_KG_M3,
      weightAssumption: `Barras del lecho elegido supuestas continuas en ${assumedLengthM} m; bastones, estribos, anclajes y desperdicio excluidos.`,
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
    candidates.push({ id: `section-${diameter}-${result.reinforcement.barCount}`, geometry: { widthMm: input.widthMm, heightMm: input.heightMm },
      reinforcement: { bed: 'top', group: { count: result.reinforcement.barCount, diameterMm: diameter }, diametersMm: result.geometry.bars.map(() => diameter) },
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
