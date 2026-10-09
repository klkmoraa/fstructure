import { analyzeBeam } from '../../../design/elements/beamAnalysis';
import { grossBeamSectionProperties } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { BEAM_DEFAULTS, beamToInput, type SpanDraft } from './beamModel';
import { parseNumber } from './common';

type BeamDraft = typeof BEAM_DEFAULTS;

export type BeamExerciseEvaluation =
  | { readonly title: string; readonly problem: string; readonly hypotheses: readonly string[]; readonly status: 'changed'; readonly reason: string }
  | { readonly title: string; readonly problem: string; readonly hypotheses: readonly string[]; readonly status: 'invalid'; readonly reason: string }
  | { readonly title: string; readonly problem: string; readonly hypotheses: readonly string[]; readonly status: 'comparable'; readonly formula: string; readonly substitution: string; readonly expectedKnm: number; readonly solverKnm: number; readonly differenceKnm: number };

interface ExerciseRecipe {
  readonly title: string;
  readonly problem: string;
  readonly hypotheses: readonly string[];
  readonly kind: 'simple' | 'cantilever' | 'point';
}

const RECIPES: Readonly<Record<string, ExerciseRecipe>> = {
  'exercise-beam-simple': { title: 'Viga simplemente apoyada', problem: 'Carga muerta uniforme de 10 kN/m en un claro de 5 m. Sin peso propio.', hypotheses: ['Un claro', 'Apoyos simples estables', 'Carga uniforme hacia abajo', 'Sin peso propio ni cargas puntuales'], kind: 'simple' },
  'exercise-beam-cantilever': { title: 'Voladizo con carga uniforme', problem: 'Carga muerta uniforme de 5 kN/m en un voladizo de 2 m. Sin peso propio.', hypotheses: ['Un claro', 'Un extremo empotrado y otro libre', 'Carga uniforme hacia abajo', 'Sin peso propio ni cargas puntuales'], kind: 'cantilever' },
  'exercise-beam-point': { title: 'Viga con carga puntual', problem: 'Carga muerta puntual de 10 kN al centro de un claro de 4 m. Sin peso propio.', hypotheses: ['Un claro', 'Apoyos simples estables', 'Una carga puntual centrada', 'Sin peso propio ni carga uniforme'], kind: 'point' },
};

const finite = (values: readonly number[]) => values.every(Number.isFinite);
const changed = (recipe: ExerciseRecipe, reason: string): BeamExerciseEvaluation => ({ ...recipe, status: 'changed', reason });
const invalid = (recipe: ExerciseRecipe, reason: string): BeamExerciseEvaluation => ({ ...recipe, status: 'invalid', reason });

/** Evalúa la referencia educativa únicamente mientras el borrador cumple sus hipótesis. */
export function evaluateBeamExercise(code: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[]): BeamExerciseEvaluation | null {
  const recipe = RECIPES[draft.exercise];
  if (!recipe) return null;

  const input = beamToInput(code, draft, spans);
  const numbers = input.spans.flatMap((span) => [span.lengthM, span.deadKnPerM, span.liveKnPerM,
    ...(draft.points === 'yes' ? [span.pointDeadKn, span.pointLiveKn, span.pointAtM] : [])]);
  if (!finite(numbers) || !finite([input.widthMm, input.heightMm, input.fcMpa,
    ...(input.flange ? [input.flange.widthMm, input.flange.thicknessMm] : [])])) return invalid(recipe, 'Completa las longitudes, cargas y propiedades de sección con valores numéricos finitos.');
  if (input.spans.some((span) => span.lengthM <= 0 || span.deadKnPerM < 0 || span.liveKnPerM < 0
    || span.pointDeadKn < 0 || span.pointLiveKn < 0 || span.pointAtM < 0 || span.pointAtM > span.lengthM)) {
    return invalid(recipe, 'Usa claros positivos y cargas hacia abajo no negativas dentro del claro.');
  }
  if (!(input.widthMm > 0 && input.heightMm > 0 && parseNumber(draft.fc) > 0)) return invalid(recipe, 'Completa una sección y resistencia de concreto positivas.');
  if (input.flange && (!(input.flange.widthMm >= input.widthMm) || !(input.flange.thicknessMm > 0 && input.flange.thicknessMm < input.heightMm)
    || !finite([input.flange.clearDistanceMm ?? 0]) || (input.flange.clearDistanceMm ?? 0) < 0)) return invalid(recipe, 'Completa un patín físicamente válido para la sección capturada.');

  if (spans.length !== 1) return changed(recipe, 'La referencia requiere exactamente un claro.');
  if (input.includeSelfWeight) return changed(recipe, 'La referencia supone que el peso propio está apagado.');
  if (recipe.kind === 'cantilever') {
    if (!((input.leftEnd === 'fixed' && input.rightEnd === 'free') || (input.leftEnd === 'free' && input.rightEnd === 'fixed'))) return changed(recipe, 'La referencia requiere un extremo empotrado y el otro libre.');
  } else if (!(['pin', 'roller'].includes(input.leftEnd) && ['pin', 'roller'].includes(input.rightEnd)
    && (input.leftEnd === 'pin' || input.rightEnd === 'pin'))) {
    return changed(recipe, 'La referencia requiere apoyos simples estables, con al menos un apoyo que restrinja el desplazamiento horizontal.');
  }

  const span = input.spans[0]!;
  let expectedKnm: number;
  let formula: string;
  let substitution: string;
  if (recipe.kind === 'point') {
    if (span.deadKnPerM !== 0 || span.liveKnPerM !== 0) return changed(recipe, 'La referencia puntual no incluye cargas uniformes.');
    const totalPoint = span.pointDeadKn + span.pointLiveKn;
    if (draft.points !== 'yes' || totalPoint <= 0) return invalid(recipe, 'Captura una carga puntual positiva para comparar.');
    if (Math.abs(span.pointAtM - span.lengthM / 2) > 1e-9 * Math.max(1, span.lengthM)) return changed(recipe, 'La carga puntual debe permanecer al centro del claro.');
    expectedKnm = totalPoint * span.lengthM / 4;
    formula = '|M|max = PL/4';
    substitution = `P = ${span.pointDeadKn} + ${span.pointLiveKn} kN; L = ${span.lengthM} m`;
  } else {
    if (span.pointDeadKn !== 0 || span.pointLiveKn !== 0) return changed(recipe, 'La referencia uniforme no incluye cargas puntuales.');
    const q = span.deadKnPerM + span.liveKnPerM;
    if (q <= 0) return invalid(recipe, 'Captura una carga uniforme positiva para comparar.');
    expectedKnm = q * span.lengthM ** 2 / (recipe.kind === 'simple' ? 8 : 2);
    formula = recipe.kind === 'simple' ? '|M|max = qL²/8' : '|M|max = qL²/2';
    substitution = `q = ${span.deadKnPerM} + ${span.liveKnPerM} kN/m; L = ${span.lengthM} m`;
  }
  if (!Number.isFinite(expectedKnm)) return invalid(recipe, 'Los valores capturados exceden el intervalo numérico de la referencia.');

  const section = grossBeamSectionProperties(input.widthMm, input.heightMm, input.flange);
  const elasticModulusKpa = designCode(code).elasticModulusMpa(input.fcMpa) * 1e3;
  if (!finite([section.areaMm2, section.inertiaMm4, elasticModulusKpa]) || section.areaMm2 <= 0 || section.inertiaMm4 <= 0 || elasticModulusKpa <= 0) {
    return invalid(recipe, 'La sección o el material no producen propiedades físicas numéricas válidas.');
  }
  const analysis = analyzeBeam({
    spans: input.spans,
    leftEnd: input.leftEnd,
    rightEnd: input.rightEnd,
    selfWeightKnPerM: 0,
    elasticModulusKpa,
    areaM2: section.areaMm2 / 1e6,
    inertiaM4: section.inertiaMm4 / 1e12,
  });
  if (!analysis.ok) return changed(recipe, `El solver no puede resolver estas hipótesis: ${analysis.error}`);
  const { deadPerSpan, livePerSpan } = analysis.analysis;
  const stationCount = analysis.analysis.stations.length;
  const moments = Array.from({ length: stationCount }, (_, station) =>
    deadPerSpan.reduce((sum, response) => sum + response.moment[station]!, 0)
    + livePerSpan.reduce((sum, response) => sum + response.moment[station]!, 0));
  if (!finite(moments)) return invalid(recipe, 'El solver no produjo una respuesta numérica válida.');
  const solverKnm = Math.max(...moments.map(Math.abs));
  return { ...recipe, status: 'comparable', formula, substitution, expectedKnm, solverKnm, differenceKnm: Math.abs(solverKnm - expectedKnm) };
}
