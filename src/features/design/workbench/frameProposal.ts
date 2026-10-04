import type { DesignCodeId } from '../../../design/elements/codes';
import type { StructureDesignResult } from '../../../design/elements/structure';
import { designFromDraft, type BayDraft, type FrameDraft, type StoryDraft } from './frameModel';
import { parseNumber } from './common';

/** Sección rectangular, cm. */
export interface ProposedSection { readonly width: number; readonly height: number }

export interface SectionProposal {
  readonly beam: ProposedSection;
  /** Columna cuadrada, con sus barras por cara (la varilla del borrador). */
  readonly column: ProposedSection & { readonly barsPerFace: number };
  /** Cociente que rige con las secciones propuestas. */
  readonly ratio: number;
  /** Volumen de concreto de vigas y columnas, m³. */
  readonly volumeM3: number;
  /** Diseños completos que costó encontrarla. */
  readonly trials: number;
}

export type ProposalStep =
  | { readonly kind: 'trying'; readonly phase: 'grow' | 'trim'; readonly beam: ProposedSection; readonly column: ProposedSection; readonly trial: number }
  | { readonly kind: 'done'; readonly proposal: SectionProposal }
  | { readonly kind: 'failed'; readonly reason: string; readonly trials: number };

/** Paso de la búsqueda (cm) y límites prácticos del pórtico rápido. */
const STEP_CM = 5;
const BEAM_MIN = { width: 25, height: 35 } as const;
const BEAM_MAX = { width: 60, height: 120 } as const;
/** Una viga entre 1 y 3 veces más peraltada que ancha. */
const BEAM_MAX_ASPECT = 3;
const COLUMN_MIN = 30;
const COLUMN_MAX = 120;
/** Cuantía con la que se arman las columnas propuestas (la mínima de las tres normas). */
const COLUMN_RATIO = 0.01;
const MAX_TRIALS = 90;

interface Candidate { readonly b: number; readonly h: number; readonly c: number }

/** Volumen de concreto de vigas y columnas del pórtico rápido con las secciones del borrador, m³. */
export function frameConcreteVolume(draft: Pick<FrameDraft, 'beamWidth' | 'beamHeight' | 'columnWidth' | 'columnHeight'>, bays: readonly BayDraft[], stories: readonly StoryDraft[]): number {
  const beamLength = bays.reduce((sum, bay) => sum + parseNumber(bay.length), 0) * stories.length;
  const columnLength = stories.reduce((sum, story) => sum + parseNumber(story.height), 0) * (bays.length + 1);
  return (beamLength * parseNumber(draft.beamWidth) * parseNumber(draft.beamHeight) + columnLength * parseNumber(draft.columnWidth) * parseNumber(draft.columnHeight)) / 1e4;
}

/** Barras por cara (con esquinas) de una columna cuadrada de `c` cm para llegar al 1 % con la varilla dada. */
export function columnBarsPerFace(c: number, barDiameterMm: number): number {
  const barAreaCm2 = Math.PI * (barDiameterMm / 10) ** 2 / 4;
  return Math.max(2, Math.ceil(COLUMN_RATIO * c * c / Math.max(barAreaCm2, 1e-9) / 4) + 1);
}

const failed = (check: { readonly status: string; readonly ratio?: number | null }) => check.status === 'fail' || (check.ratio ?? 0) > 1;
/** Revisiones de la viga que resuelve la columna: el anclaje en los apoyos extremos se desarrolla en su peralte. */
const SOLVED_BY_COLUMN = new Set(['anchorage']);

/**
 * Lo que falla de un diseño y qué lo arregla: la viga (flexión, cortante,
 * flecha, armado) o la columna (sus revisiones, el anclaje de las vigas en ella,
 * y las del marco: deriva e índice de estabilidad).
 */
const failures = (result: StructureDesignResult) => {
  const beamChecks = result.beams.flatMap((beam) => beam.result.checks.filter(failed));
  return {
    beams: beamChecks.some((check) => !SOLVED_BY_COLUMN.has(check.id)),
    columns: beamChecks.some((check) => SOLVED_BY_COLUMN.has(check.id))
      || result.columns.some((column) => column.result.checks.some(failed))
      || result.checks.some((check) => failed(check) && !/^(beam|column)-/.test(check.id)),
  };
};

/**
 * Busca la viga y la columna (en pasos de 5 cm) con el menor volumen de
 * concreto con el que el pórtico rápido cumple.
 *
 * 1. Crecer: desde 25 × 35 y 30 × 30, en cada diseño crece sólo lo que falla (el
 *    peralte de la viga hasta 3 veces su ancho, luego el ancho; la columna
 *    cuadrada). El anclaje de las vigas en los apoyos extremos y las revisiones
 *    del marco (deriva, índice de estabilidad) hacen crecer la columna.
 * 2. Recortar: prueba, del más barato al más caro, quitar hasta 10 cm a la
 *    columna y mover ±5 cm el ancho y ±10 cm el peralte de la viga (también pasar
 *    concreto de la columna a la viga), mientras siga cumpliendo y el volumen baje.
 *
 * Cada columna se arma con la varilla del borrador y las barras por cara que dan
 * al menos 1 % de cuantía. Las cargas, claros, niveles, materiales y el armado de
 * las vigas (automático o el elegido) no cambian.
 *
 * Es un generador: cada `next()` hace a lo más un diseño completo, para que la
 * mesa lo reparta en tareas y siga respondiendo.
 */
export function* proposeFrameSections(code: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]): Generator<ProposalStep, void, void> {
  const barsPerFace = (c: number) => columnBarsPerFace(c, parseNumber(draft.columnBar));
  const beamLength = bays.reduce((sum, bay) => sum + parseNumber(bay.length), 0) * stories.length;
  const columnLength = stories.reduce((sum, story) => sum + parseNumber(story.height), 0) * (bays.length + 1);
  const volume = ({ b, h, c }: Candidate) => (beamLength * b * h + columnLength * c * c) / 1e4;
  const valid = ({ b, h, c }: Candidate) => b >= BEAM_MIN.width && b <= BEAM_MAX.width && h >= Math.max(BEAM_MIN.height, b) && h <= Math.min(BEAM_MAX.height, BEAM_MAX_ASPECT * b)
    && c >= COLUMN_MIN && c <= COLUMN_MAX;

  let trials = 0;
  type Evaluation = { readonly result: StructureDesignResult; readonly passes: boolean };
  const cache = new Map<string, Evaluation | string>();
  /** Un diseño completo; los ya hechos no se repiten. */
  function* evaluate(candidate: Candidate, phase: 'grow' | 'trim'): Generator<ProposalStep, Evaluation | string, void> {
    const key = `${candidate.b}|${candidate.h}|${candidate.c}`;
    const known = cache.get(key);
    if (known) return known;
    trials += 1;
    yield { kind: 'trying', phase, beam: { width: candidate.b, height: candidate.h }, column: { width: candidate.c, height: candidate.c }, trial: trials };
    const bars = String(barsPerFace(candidate.c));
    const outcome = designFromDraft(code, {
      ...draft, source: 'frame',
      beamWidth: String(candidate.b), beamHeight: String(candidate.h),
      columnWidth: String(candidate.c), columnHeight: String(candidate.c), barsWidth: bars, barsDepth: bars,
    }, bays, stories);
    const evaluation = outcome.ok
      ? { result: outcome.result, passes: outcome.result.status !== 'fail' && outcome.result.governingRatio <= 1 }
      : outcome.errors[0] ?? 'El pórtico no se pudo diseñar.';
    cache.set(key, evaluation);
    return evaluation;
  }

  // 1. Crecer hasta cumplir.
  let current: Candidate = { b: BEAM_MIN.width, h: BEAM_MIN.height, c: COLUMN_MIN };
  let best: Evaluation | null = null;
  while (!best) {
    if (trials >= MAX_TRIALS) { yield { kind: 'failed', reason: `Sin propuesta tras ${MAX_TRIALS} diseños.`, trials }; return; }
    const evaluation = yield* evaluate(current, 'grow');
    if (typeof evaluation === 'string') { yield { kind: 'failed', reason: evaluation, trials }; return; }
    if (evaluation.passes) { best = evaluation; break; }
    const failing = failures(evaluation.result);
    let next = current;
    if (failing.beams) {
      const deeper = { ...next, h: next.h + STEP_CM };
      const wider = { ...next, b: next.b + STEP_CM };
      next = valid(deeper) ? deeper : valid(wider) ? wider : next;
    }
    // Sin una falla de viga, más columna (también si la falla no tiene cociente).
    if (failing.columns || !failing.beams) {
      const bigger = { ...next, c: next.c + STEP_CM };
      if (valid(bigger)) next = bigger;
    }
    if (next === current) {
      yield {
        kind: 'failed', trials,
        reason: `Ni con viga ${current.b}×${current.h} y columna ${current.c}×${current.c} cumple: revisa claros, cargas, materiales o armado.`,
      };
      return;
    }
    current = next;
  }

  // 2. Recortar: el vecino más barato que siga cumpliendo, hasta que ninguno baje el
  // volumen. Vecinos: hasta 10 cm menos de columna y ±5 cm de ancho y ±10 cm de
  // peralte de viga. Uno más chico en todo que otro que ya falló no se diseña.
  const failing: Candidate[] = [];
  const dominated = (candidate: Candidate) => failing.some((known) => candidate.b <= known.b && candidate.h <= known.h && candidate.c <= known.c);
  for (;;) {
    const neighbours: Candidate[] = [];
    for (const dc of [0, -STEP_CM, -2 * STEP_CM]) {
      for (const db of [-STEP_CM, 0, STEP_CM]) {
        for (const dh of [-2 * STEP_CM, -STEP_CM, 0, STEP_CM, 2 * STEP_CM]) {
          const candidate = { b: current.b + db, h: current.h + dh, c: current.c + dc };
          if ((dc || db || dh) && valid(candidate) && volume(candidate) < volume(current) - 1e-9) neighbours.push(candidate);
        }
      }
    }
    neighbours.sort((a, b) => volume(a) - volume(b));
    let moved = false;
    for (const candidate of neighbours) {
      if (trials >= MAX_TRIALS) break;
      if (dominated(candidate)) continue;
      const evaluation = yield* evaluate(candidate, 'trim');
      if (typeof evaluation !== 'string' && evaluation.passes) { current = candidate; best = evaluation; moved = true; break; }
      failing.push(candidate);
    }
    if (!moved) break;
  }

  yield {
    kind: 'done',
    proposal: {
      beam: { width: current.b, height: current.h },
      column: { width: current.c, height: current.c, barsPerFace: barsPerFace(current.c) },
      ratio: best.result.governingRatio,
      volumeM3: volume(current),
      trials,
    },
  };
}
