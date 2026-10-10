import { designCode, isDesignCodeId, type DesignCodeId } from './codes';
import { layoutBeamBed, type BeamBarPlacement } from './beamBarLayout';
import { complementary, equivalentBlockStrengthMpa, flexuralCapacity, requiredFlexuralSteelMm2, type ElementCheck } from './shared';

export interface BarGroup { readonly count: number; readonly diameterMm: number }
export interface FlexureExerciseInput {
  readonly code: DesignCodeId;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly coverMm: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly stirrupDiameterMm: number;
  readonly aggregateMm: number;
  /** Sign selects the tension bed; magnitude is the flexural demand. */
  readonly momentKnM: number;
  readonly top: BarGroup;
  readonly bottom: BarGroup;
}
export interface FlexureExerciseResult {
  readonly requiredMm2: number;
  readonly minimumMm2: number;
  readonly providedMm2: number;
  readonly effectiveDepthMm: number;
  readonly extremeDepthMm: number;
  readonly requiredBlockDepthMm: number;
  readonly requiredResistanceFactor: number;
  readonly requiredTensileStrain: number;
  readonly requiredCapacityKnM: number;
  readonly capacityKnM: number;
  readonly layout: { readonly tensionBed: 'top' | 'bottom'; readonly bars: readonly BeamBarPlacement[] | null };
  readonly checks: readonly ElementCheck[];
  readonly notes: readonly string[];
  readonly status: 'pass' | 'fail' | 'warning';
}
export interface FlexureDimensionBounds {
  readonly widthMinMm: number;
  readonly widthMaxMm: number;
  readonly heightMinMm: number;
  readonly heightMaxMm: number;
  readonly stepMm: number;
}

const validGroup = (group: BarGroup) => Number.isSafeInteger(group.count) && group.count > 0 && Number.isFinite(group.diameterMm) && group.diameterMm > 0;
const area = (group: BarGroup) => validGroup(group) ? group.count * Math.PI * group.diameterMm ** 2 / 4 : 0;

export function designFlexureExercise(input: FlexureExerciseInput): FlexureExerciseResult {
  const code = designCode(input.code);
  const tensionBed = input.momentKnM < 0 ? 'top' : 'bottom';
  const group = input[tensionBed];
  const validGeometry = [input.widthMm, input.heightMm, input.fcMpa, input.fyMpa, input.stirrupDiameterMm, input.aggregateMm, input.coverMm, input.momentKnM].every(Number.isFinite)
    && input.widthMm > 0 && input.heightMm > 0 && input.fcMpa > 0 && input.fyMpa > 0 && input.stirrupDiameterMm > 0 && input.aggregateMm >= 0 && input.coverMm >= 0;
  const bars = validGeometry && validGroup(group)
    ? layoutBeamBed({ widthMm: input.widthMm, heightMm: input.heightMm, coverMm: input.coverMm, stirrupDiameterMm: input.stirrupDiameterMm,
      minimumClearSpacingMm: code.beam.minimumClearSpacing(group.diameterMm, input.aggregateMm), continuous: group, extra: null })
    : null;
  const providedAreaForLayout = bars?.reduce((sum, bar) => sum + Math.PI * bar.diameterMm ** 2 / 4, 0) ?? 0;
  const centroidFromTensionFace = bars && providedAreaForLayout > 0
    ? bars.reduce((sum, bar) => sum + (Math.PI * bar.diameterMm ** 2 / 4) * bar.fromFaceMm, 0) / providedAreaForLayout
    : input.coverMm + input.stirrupDiameterMm + group.diameterMm / 2;
  const extremeFromTensionFace = bars ? Math.min(...bars.map((bar) => bar.fromFaceMm)) : centroidFromTensionFace;
  const effectiveDepthMm = input.heightMm - centroidFromTensionFace;
  const extremeDepthMm = input.heightMm - extremeFromTensionFace;
  const required = validGeometry && effectiveDepthMm > 0
    ? requiredFlexuralSteelMm2(Math.abs(input.momentKnM), input.widthMm, effectiveDepthMm, input.fyMpa, input.fcMpa, extremeDepthMm, code.flexureFactor, code.tensionControlledStrain)
    : undefined;
  const requiredMm2 = required ?? Number.POSITIVE_INFINITY;
  // Evaluate the shared profile law at As=0 too; zero demand still has a real factor.
  const requiredResistance = validGeometry && required !== undefined
    ? flexuralCapacity(required, input.widthMm, effectiveDepthMm, input.fyMpa, input.fcMpa, extremeDepthMm, code.flexureFactor)
    : null;
  const requiredBlockDepthMm = requiredResistance && validGeometry
    ? requiredMm2 * input.fyMpa / (equivalentBlockStrengthMpa(input.fcMpa) * input.widthMm)
    : 0;
  const requiredResistanceFactor = requiredResistance?.resistanceFactor ?? 0;
  const requiredTensileStrain = requiredResistance?.netTensileStrain ?? 0;
  const requiredCapacityKnM = requiredResistance?.strengthKnm ?? 0;
  const minimumMm2 = validGeometry && effectiveDepthMm > 0 ? code.beam.minimumSteel(input.widthMm, effectiveDepthMm, input.heightMm, input.fcMpa, input.fyMpa, extremeDepthMm) : 0;
  const providedMm2 = area(group);
  const maximumMm2 = validGeometry && effectiveDepthMm > 0 ? code.beam.maximumSteel(input.widthMm, effectiveDepthMm, extremeDepthMm, input.fcMpa, input.fyMpa) : 0;
  const capacityKnM = validGeometry && bars && providedMm2 > 0
    ? flexuralCapacity(providedMm2, input.widthMm, effectiveDepthMm, input.fyMpa, input.fcMpa, extremeDepthMm, code.flexureFactor).strengthKnm
    : 0;
  const checks: ElementCheck[] = [
    { id: 'bar-layout', label: 'Acomodo del lecho a tensión', status: bars ? 'pass' : 'fail', reference: complementary('Geometría física de barras'), note: bars ? undefined : 'Las barras no caben con recubrimiento y separación mínima.' },
    { id: 'flexure', label: 'Resistencia a flexión', status: required !== undefined && capacityKnM >= Math.abs(input.momentKnM) * (1 - 1e-9) ? 'pass' : 'fail', demand: Math.abs(input.momentKnM), capacity: capacityKnM, unit: 'kN·m', reference: code.refs.flexure },
    { id: 'steel-min', label: 'Acero mínimo', status: providedMm2 >= minimumMm2 ? 'pass' : 'fail', demand: minimumMm2, capacity: providedMm2, unit: 'mm²', reference: code.refs.steelMin },
    { id: 'steel-max', label: 'Acero máximo', status: providedMm2 <= maximumMm2 ? 'pass' : 'fail', demand: providedMm2, capacity: maximumMm2, unit: 'mm²', reference: code.refs.steelMax, note: code.beam.maximumSteelNote },
    { id: 'shear-scope', label: 'Cortante', status: 'out-of-scope', reference: complementary('Alcance no evaluado'), note: 'No se evalúa cortante.' },
    { id: 'development-scope', label: 'Desarrollo y anclaje', status: 'out-of-scope', reference: complementary('Alcance no evaluado'), note: 'No se evalúa desarrollo ni anclaje.' },
    { id: 'service-scope', label: 'Servicio y deformación', status: 'out-of-scope', reference: complementary('Alcance no evaluado'), note: 'No se evalúa servicio ni deformación.' },
    { id: 'axial-biaxial-scope', label: 'Carga axial y flexión biaxial', status: 'out-of-scope', reference: complementary('Alcance no evaluado'), note: 'No se evalúan carga axial ni flexión biaxial.' },
  ];
  const evaluated = checks.filter((check) => check.status !== 'out-of-scope');
  const status = evaluated.some((check) => check.status === 'fail') ? 'fail' : 'warning';
  return { requiredMm2, minimumMm2, providedMm2, effectiveDepthMm, extremeDepthMm, requiredBlockDepthMm, requiredResistanceFactor, requiredTensileStrain, requiredCapacityKnM, capacityKnM, layout: { tensionBed, bars }, checks, status,
    notes: ['Flexión simple rectangular: sin cortante, desarrollo, servicio, carga axial ni flexión biaxial.'] };
}

export function proposeFlexureDimensions(input: FlexureExerciseInput, bounds: FlexureDimensionBounds): { widthMm: number; heightMm: number; result: FlexureExerciseResult } | null {
  const { widthMinMm, widthMaxMm, heightMinMm, heightMaxMm, stepMm } = bounds;
  const finiteBounds = [widthMinMm, widthMaxMm, heightMinMm, heightMaxMm, stepMm].every(Number.isFinite);
  const tensionGroup = input.momentKnM < 0 ? input.top : input.bottom;
  const finiteInputs = isDesignCodeId(input.code)
    && [input.coverMm, input.fcMpa, input.fyMpa, input.stirrupDiameterMm, input.aggregateMm, input.momentKnM,
      tensionGroup.count, tensionGroup.diameterMm].every(Number.isFinite)
    && input.coverMm >= 0 && input.fcMpa > 0 && input.fyMpa > 0 && input.stirrupDiameterMm > 0 && input.aggregateMm >= 0
    && tensionGroup.count > 0 && tensionGroup.diameterMm > 0;
  if (!finiteBounds || !finiteInputs || stepMm <= 0 || widthMinMm <= 0 || heightMinMm <= 0 || widthMaxMm < widthMinMm || heightMaxMm < heightMinMm) return null;
  const widthSteps = Math.floor((widthMaxMm - widthMinMm) / stepMm + 1e-12);
  const heightSteps = Math.floor((heightMaxMm - heightMinMm) / stepMm + 1e-12);
  const widthCount = widthSteps + 1;
  const heightCount = heightSteps + 1;
  // Keep worker work strictly bounded; the default search has 9 × 26 = 234 candidates.
  const MAX_CANDIDATES = 10_000;
  const candidateCount = widthCount * heightCount;
  if (!Number.isSafeInteger(widthCount) || !Number.isSafeInteger(heightCount) || !Number.isSafeInteger(candidateCount) || candidateCount > MAX_CANDIDATES) return null;
  const candidates: { widthMm: number; heightMm: number; result: FlexureExerciseResult; area: number }[] = [];
  for (let widthIndex = 0; widthIndex < widthCount; widthIndex += 1) {
    const widthMm = widthMinMm + widthIndex * stepMm;
    for (let heightIndex = 0; heightIndex < heightCount; heightIndex += 1) {
      const heightMm = heightMinMm + heightIndex * stepMm;
      const result = designFlexureExercise({ ...input, widthMm, heightMm });
      if (result.status !== 'fail') candidates.push({ widthMm, heightMm, result, area: widthMm * heightMm });
    }
  }
  candidates.sort((a, b) => a.area - b.area || a.widthMm - b.widthMm || a.heightMm - b.heightMm);
  const best = candidates[0];
  return best ? { widthMm: best.widthMm, heightMm: best.heightMm, result: best.result } : null;
}
