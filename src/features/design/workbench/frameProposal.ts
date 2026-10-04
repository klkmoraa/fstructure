import type { ConcreteSectionGroup } from '../../../data/concreteFrame';
import type { DesignCodeId } from '../../../design/elements/codes';
import type { ExternalStructureSource, StructureDesignResult } from '../../../design/elements/structure';
import { designFromDraft, type BayDraft, type FrameDraft, type StoryDraft, type StructureOutcome } from './frameModel';
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
  readonly groups?: readonly ConcreteSectionGroup[];
  readonly uniformVolumeM3?: number;
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
  const beamLength = bays.reduce((sum, bay) => sum + parseNumber(bay.length), 0);
  return stories.reduce((volume, story) => volume + (
    beamLength * parseNumber(story.beamWidth ?? draft.beamWidth) * parseNumber(story.beamHeight ?? draft.beamHeight)
    + parseNumber(story.height) * (bays.length + 1) * parseNumber(story.columnWidth ?? draft.columnWidth) * parseNumber(story.columnHeight ?? draft.columnHeight)
  ) / 1e4, 0);
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

/** Lo que la búsqueda necesita de una estructura: cómo diseñarla con unas secciones y cuánto mide. */
export interface SectionSearch {
  /** Diseña con la viga y la columna (cm) y las barras por cara de la columna. */
  readonly design: (beam: ProposedSection, column: ProposedSection, barsPerFace: number) => StructureOutcome;
  /** Longitud total de vigas y de columnas, m (para el volumen de concreto). */
  readonly beamLengthM: number;
  readonly columnLengthM: number;
  /** Varilla de las columnas, mm. */
  readonly barDiameterMm: number;
}

/**
 * Busca la viga y la columna (en pasos de 5 cm) con el menor volumen de
 * concreto con el que la estructura cumple.
 *
 * 1. Crecer: desde 25 × 35 y 30 × 30, en cada diseño crece sólo lo que falla (el
 *    peralte de la viga hasta 3 veces su ancho, luego el ancho; la columna
 *    cuadrada). El anclaje de las vigas en los apoyos extremos y las revisiones
 *    del marco (deriva, índice de estabilidad) hacen crecer la columna.
 * 2. Recortar: prueba, del más barato al más caro, quitar hasta 10 cm a la
 *    columna y mover ±5 cm el ancho y ±10 cm el peralte de la viga (también pasar
 *    concreto de la columna a la viga), mientras siga cumpliendo y el volumen baje.
 *
 * Cada columna se arma con la varilla dada y las barras por cara que dan al
 * menos 1 % de cuantía.
 *
 * Es un generador: cada `next()` hace a lo más un diseño completo, para que la
 * mesa lo reparta en tareas y siga respondiendo.
 */
export function* searchSections(search: SectionSearch): Generator<ProposalStep, void, void> {
  const barsPerFace = (c: number) => columnBarsPerFace(c, search.barDiameterMm);
  const volume = ({ b, h, c }: Candidate) => (search.beamLengthM * b * h + search.columnLengthM * c * c) / 1e4;
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
    const outcome = search.design({ width: candidate.b, height: candidate.h }, { width: candidate.c, height: candidate.c }, barsPerFace(candidate.c));
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

/**
 * El pórtico rápido del borrador: sus cargas, claros, niveles, materiales y el
 * armado de las vigas (automático o el elegido) no cambian.
 */
export function proposeUniformFrameSections(code: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]): Generator<ProposalStep, void, void> {
  return searchSections({
    beamLengthM: bays.reduce((sum, bay) => sum + parseNumber(bay.length), 0) * stories.length,
    columnLengthM: stories.reduce((sum, story) => sum + parseNumber(story.height), 0) * (bays.length + 1),
    barDiameterMm: parseNumber(draft.columnBar),
    design: (beam, column, bars) => designFromDraft(code, {
      ...draft, source: 'frame',
      beamWidth: String(beam.width), beamHeight: String(beam.height),
      columnWidth: String(column.width), columnHeight: String(column.height), barsWidth: String(bars), barsDepth: String(bars),
    }, bays, stories),
  });
}

/**
 * Una estructura del proyecto (el Modelo 2D): cada candidato se diseña con la
 * fuente que entrega `variant`, el modelo con esas secciones en todas sus vigas
 * y columnas de concreto. El modelo no cambia hasta aplicar la propuesta.
 */
function proposeUniformModelSections(code: DesignCodeId, draft: FrameDraft, model: {
  readonly beamLengthM: number;
  readonly columnLengthM: number;
  readonly groups?: readonly ConcreteSectionGroup[];
  readonly variant: (beam: ProposedSection, column: ProposedSection, groups?: readonly ConcreteSectionGroup[]) => ExternalStructureSource;
}): Generator<ProposalStep, void, void> {
  return searchSections({
    beamLengthM: model.beamLengthM,
    columnLengthM: model.columnLengthM,
    barDiameterMm: parseNumber(draft.columnBar),
    design: (beam, column, bars) => designFromDraft(code, { ...draft, barsWidth: String(bars), barsDepth: String(bars) }, [], [], model.variant(beam, column)),
  });
}

/** Ajuste por grupo desde una solución uniforme válida: descenso hasta que ningún paso de 5 cm ahorra y cumple. */
export function* trimSectionGroups(uniform: Generator<ProposalStep, void, void>, groups: readonly ConcreteSectionGroup[],
  design: (proposal: SectionProposal) => StructureOutcome): Generator<ProposalStep, void, void> {
  let base: SectionProposal | null = null;
  for (const step of uniform) {
    if (step.kind === 'done') base = step.proposal;
    else { yield step; if (step.kind === 'failed') return; }
  }
  if (!base) return;
  let current: SectionProposal = { ...base, uniformVolumeM3: base.volumeM3, groups: groups.map((group) => ({ ...group, ...(group.kind === 'beam' ? base!.beam : base!.column) })) };
  let trials = base.trials;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < groups.length; i++) {
      const group = current.groups![i]!;
      const candidates = group.kind === 'column'
        ? [{ width: group.width - STEP_CM, height: group.height - STEP_CM }]
        : [{ width: group.width, height: group.height - STEP_CM }, { width: group.width - STEP_CM, height: group.height }];
      for (const section of candidates) {
        if (group.kind === 'column' ? section.width < COLUMN_MIN
          : section.width < BEAM_MIN.width || section.height < Math.max(BEAM_MIN.height, section.width) || section.height > BEAM_MAX_ASPECT * section.width) continue;
        if (++trials > 1200) { yield { kind: 'failed', reason: 'La búsqueda por grupo agotó su límite; no se aplicó ninguna sección.', trials }; return; }
        yield { kind: 'trying', phase: 'trim', beam: current.beam, column: current.column, trial: trials };
        const nextGroups = current.groups!.map((item, index) => index === i ? { ...item, ...section } : item);
        const volumeM3 = nextGroups.reduce((sum, item) => sum + item.lengthM * item.width * item.height / 1e4, 0);
        const outcome = design({ ...current, groups: nextGroups, volumeM3 });
        if (outcome.ok && outcome.result.status !== 'fail' && outcome.result.governingRatio <= 1) {
          current = { ...current, groups: nextGroups, volumeM3, ratio: outcome.result.governingRatio }; changed = true; break;
        }
      }
    }
  }
  // Incluye la verificación final, incluso si todos los grupos están en el mínimo geométrico.
  trials++;
  yield { kind: 'trying', phase: 'trim', beam: current.beam, column: current.column, trial: trials };
  const final = design(current);
  if (!final.ok || final.result.status === 'fail' || final.result.governingRatio > 1) {
    yield { kind: 'failed', reason: 'La propuesta por grupo no pasó la verificación final.', trials }; return;
  }
  yield { kind: 'done', proposal: { ...current, ratio: final.result.governingRatio, trials } };
}

export function frameProposalStories(stories: readonly StoryDraft[], proposal: SectionProposal): StoryDraft[] {
  return stories.map((story, index) => {
    const beam = proposal.groups?.find((group) => group.id === `beam:${index}`) ?? proposal.beam;
    const column = proposal.groups?.find((group) => group.id === `column:${index}`) ?? proposal.column;
    return { ...story, beamWidth: String(beam.width), beamHeight: String(beam.height), columnWidth: String(column.width), columnHeight: String(column.height) };
  });
}

export function proposeFrameSections(code: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]): Generator<ProposalStep, void, void> {
  // La referencia uniforme ignora las secciones previamente propuestas por nivel.
  const plain = stories.map(({ height, dead, live, lateral }) => ({ height, dead, live, lateral }));
  const groups: ConcreteSectionGroup[] = plain.flatMap((story, index) => [
    { id: `beam:${index}`, label: `Vigas N${index + 1}`, kind: 'beam' as const, memberIds: bays.map((_, b) => `V${index + 1}-${b + 1}`), lengthM: bays.reduce((sum, bay) => sum + parseNumber(bay.length), 0), width: 0, height: 0 },
    { id: `column:${index}`, label: `Columnas N${index}–N${index + 1}`, kind: 'column' as const, memberIds: Array.from({ length: bays.length + 1 }, (_, c) => `C${c + 1}-${index + 1}`), lengthM: parseNumber(story.height) * (bays.length + 1), width: 0, height: 0 },
  ]);
  return trimSectionGroups(proposeUniformFrameSections(code, draft, bays, plain), groups,
    (proposal) => designFromDraft(code, { ...draft, source: 'frame', proposalBars: 'yes' }, bays, frameProposalStories(plain, proposal)));
}

export function proposeModelSections(code: DesignCodeId, draft: FrameDraft, model: {
  readonly beamLengthM: number; readonly columnLengthM: number;
  readonly groups?: readonly ConcreteSectionGroup[];
  readonly variant: (beam: ProposedSection, column: ProposedSection, groups?: readonly ConcreteSectionGroup[]) => ExternalStructureSource;
}): Generator<ProposalStep, void, void> {
  const uniform = proposeUniformModelSections(code, draft, model);
  if (!model.groups?.length) return uniform;
  return trimSectionGroups(uniform, model.groups,
    (proposal) => designFromDraft(code, { ...draft, proposalBars: 'yes' }, [], [], model.variant(proposal.beam, proposal.column, proposal.groups)));
}
