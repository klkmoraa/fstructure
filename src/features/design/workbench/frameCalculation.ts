import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import type { ColumnGroup } from '../../../design/elements/column';
import { MAX_FRAME_BAYS, MAX_FRAME_STORIES, designFrame, type FrameDesignInput, type FrameDesignResult } from '../../../design/elements/frame';
import { designStructure, type ExternalStructureAxes, type ExternalStructureSource, type StructureDesignOptions, type StructureDesignResult } from '../../../design/elements/structure';
import { isShortString, mpaFromKgcm2, parseNumber, sustainedRatioFor, xiFor } from './formNumbers';
import type { ConcreteFrameSpec } from '../../../data/concreteFrame';

/**
 * Estructura: del borrador del formulario a la entrada del motor y a la
 * memoria. La fuente es el Modelo 2D del proyecto (`source: 'model'`, la de
 * siempre en la mesa de FStructure), un eje del Modelo 3D (`source:
 * 'model3d'`, con `axis`) o un pórtico paramétrico rápido (`source: 'frame'`).
 * Lo usan la mesa y la memoria del proyecto.
 */
export const FRAME_DEFAULTS = {
  tag: '', place: '',
  source: 'model',
  /** Eje del Modelo 3D (`z:0`, `x:5`); vacío, el primero. */
  axis: '',
  base: 'fixed', braced: 'no', lateral: 'yes', selfWeight: 'yes',
  beamWidth: '30', beamHeight: '55', columnWidth: '45', columnHeight: '45', cover: '4',
  fc: '250', fy: '4200', fyv: '4200',
  proposalBars: 'no', columnBar: '19.1', barsWidth: '3', barsDepth: '3', tie: '9.5',
  group: 'B2', use: 'habitacion', sustained: '25', duration: '60',
  beamBar: 'auto', stirrup: 'auto', aggregate: '19', damages: 'no',
  beamInertia: '1', columnInertia: '1', k: '',
  /** Cargas desde la losa: ancho tributario (m), muerta y viva de la losa (kN/m²) y muros sobre la viga (kN/m). */
  tributary: '4', slabDead: '4.5', slabLive: '1.9', wallLoad: '4',
};
export type FrameDraft = typeof FRAME_DEFAULTS;
/** Borradores y memorias guardados antes de la fuente Modelo 2D eran pórticos generados. */
export const FRAME_LEGACY = { source: 'frame' } as const satisfies Partial<FrameDraft>;

export type BayDraft = { length: string };
export type StoryDraft = { height: string; dead: string; live: string; lateral: string; beamWidth?: string; beamHeight?: string; columnWidth?: string; columnHeight?: string };

export const DEFAULT_BAYS: BayDraft[] = [{ length: '5' }, { length: '4' }];
export const DEFAULT_STORIES: StoryDraft[] = [
  { height: '3.5', dead: '22', live: '7.6', lateral: '60' },
  { height: '3', dead: '18', live: '5', lateral: '45' },
];

const rowsOf = <T extends Record<string, string>>(raw: unknown, fields: readonly (keyof T & string)[], max: number): T[] | undefined => {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > max) return undefined;
  const rows = raw.map((item: unknown) => {
    if (!item || typeof item !== 'object') return undefined;
    const record = item as Record<string, unknown>;
    return fields.every((field) => isShortString(record[field])) ? Object.fromEntries(fields.map((field) => [field, record[field]])) as T : undefined;
  });
  return rows.every(Boolean) ? rows as T[] : undefined;
};
export const parseBays = (raw: unknown) => rowsOf<BayDraft>(raw, ['length'], MAX_FRAME_BAYS);
export const parseStories = (raw: unknown): StoryDraft[] | undefined => {
  const base = rowsOf<StoryDraft>(raw, ['height', 'dead', 'live', 'lateral'], MAX_FRAME_STORIES);
  if (!base) return undefined;
  for (let i = 0; i < base.length; i++) for (const key of ['beamWidth', 'beamHeight', 'columnWidth', 'columnHeight'] as const) {
    const value = (raw as Record<string, unknown>[])[i]![key];
    if (value !== undefined) { if (!isShortString(value)) return undefined; base[i]![key] = value; }
  }
  return base;
};

const columnGroupOf = (value: string): ColumnGroup => value === 'A' || value === 'B1' ? value : 'B2';
/** Grupo de la construcción: A con los factores del Grupo A; B1 y B2 con los del B. */
const loadGroupOf = (value: string) => value === 'A' ? 'A' as const : 'B' as const;

/**
 * El pórtico rápido escrito como Modelo 2D: los mismos claros, niveles,
 * secciones, concreto y cargas de servicio (con su sismo si está activo, aunque
 * el marco se suponga arriostrado: eso es una hipótesis de diseño, no del modelo).
 */
export function frameModelSpec(codeId: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]): ConcreteFrameSpec {
  const input = frameToInput(codeId, draft, bays, stories);
  return {
    bays: input.bays,
    stories: stories.map((story, index) => ({ ...input.stories[index]!, lateralKn: draft.lateral === 'yes' ? parseNumber(story.lateral) : 0 })),
    base: input.base,
    beam: input.beam,
    column: input.column,
    fcMpa: input.fcMpa,
    elasticModulusKpa: designCode(codeId).elasticModulusMpa(input.fcMpa) * 1e3,
    includeSelfWeight: input.includeSelfWeight,
  };
}

export function frameToInput(codeId: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[]): FrameDesignInput {
  const code = designCode(codeId);
  const group = loadGroupOf(draft.group);
  const lateral = code.lateralCombinations(group);
  const withLateral = draft.lateral === 'yes' && draft.braced !== 'yes';
  const optional = (value: string) => value.trim() === '' ? null : parseNumber(value);
  return {
    code: codeId,
    bays: bays.map((bay) => parseNumber(bay.length)),
    stories: stories.map((story) => ({
      heightM: parseNumber(story.height),
      deadKnPerM: parseNumber(story.dead),
      liveKnPerM: parseNumber(story.live),
      lateralKn: withLateral ? parseNumber(story.lateral) : 0,
      ...(story.beamWidth !== undefined ? { beam: { widthMm: parseNumber(story.beamWidth) * 10, heightMm: parseNumber(story.beamHeight ?? draft.beamHeight) * 10 } } : {}),
      ...(story.columnWidth !== undefined ? { column: { widthMm: parseNumber(story.columnWidth) * 10, heightMm: parseNumber(story.columnHeight ?? draft.columnHeight) * 10 } } : {}),
    })),
    base: draft.base === 'pinned' ? 'pinned' : 'fixed',
    braced: draft.braced === 'yes',
    beam: { widthMm: parseNumber(draft.beamWidth) * 10, heightMm: parseNumber(draft.beamHeight) * 10 },
    column: { widthMm: parseNumber(draft.columnWidth) * 10, heightMm: parseNumber(draft.columnHeight) * 10 },
    coverMm: parseNumber(draft.cover) * 10,
    fcMpa: mpaFromKgcm2(draft.fc),
    fyMpa: mpaFromKgcm2(draft.fy),
    fyStirrupMpa: mpaFromKgcm2(draft.fyv),
    maxAggregateMm: parseNumber(draft.aggregate),
    includeSelfWeight: draft.selfWeight === 'yes',
    combinations: code.loadCombinations(group),
    lateralCombinations: lateral.combinations,
    lateralReference: lateral.reference,
    sustainedLiveRatio: code.sustainedLive === 'use' ? sustainedRatioFor(draft.use) : parseNumber(draft.sustained) / 100,
    longTermXi: xiFor(draft.duration),
    damagesNonstructural: draft.damages === 'yes',
    beamBarDiameterMm: draft.beamBar === 'auto' ? null : parseNumber(draft.beamBar),
    stirrupDiameterMm: draft.stirrup === 'auto' ? null : parseNumber(draft.stirrup),
    columnReinforcement: {
      barDiameterMm: parseNumber(draft.columnBar),
      barsAlongWidth: parseNumber(draft.barsWidth),
      barsAlongDepth: parseNumber(draft.barsDepth),
      tieDiameterMm: parseNumber(draft.tie),
    },
    automaticColumnBars: draft.proposalBars === 'yes',
    group: columnGroupOf(draft.group),
    beamInertiaFactor: parseNumber(draft.beamInertia),
    columnInertiaFactor: parseNumber(draft.columnInertia),
    effectiveLengthFactor: optional(draft.k),
  };
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const describeFrame = (input: FrameDesignInput) =>
  `${plural(input.bays.length, 'claro', 'claros')} × ${plural(input.stories.length, 'nivel', 'niveles')}${input.braced ? ' · arriostrado' : ''}`;

/** Opciones de diseño comunes a las dos fuentes: materiales, armado de columnas y criterios. */
export function structureOptions(codeId: DesignCodeId, draft: FrameDraft, fcMpa = mpaFromKgcm2(draft.fc)): StructureDesignOptions {
  const input = frameToInput(codeId, draft, [], []);
  return {
    code: codeId,
    coverMm: input.coverMm,
    fcMpa,
    fyMpa: input.fyMpa,
    fyStirrupMpa: input.fyStirrupMpa,
    maxAggregateMm: input.maxAggregateMm,
    includeSelfWeight: input.includeSelfWeight,
    combinations: input.combinations,
    lateralCombinations: input.lateralCombinations,
    ...(input.lateralReference ? { lateralReference: input.lateralReference } : {}),
    sustainedLiveRatio: input.sustainedLiveRatio,
    longTermXi: input.longTermXi,
    damagesNonstructural: input.damagesNonstructural,
    beamBarDiameterMm: input.beamBarDiameterMm,
    stirrupDiameterMm: input.stirrupDiameterMm,
    columnReinforcement: input.columnReinforcement,
    automaticColumnBars: input.automaticColumnBars,
    group: input.group,
    effectiveLengthFactor: input.effectiveLengthFactor,
  };
}

/** Resultado de la mesa: la estructura diseñada y, si viene del generador, el pórtico. */
export type StructureOutcome =
  | { readonly ok: true; readonly result: StructureDesignResult; readonly frame: FrameDesignResult | null }
  | { readonly ok: false; readonly errors: readonly string[] };

export const MODEL_MISSING = 'No hay Modelo 2D en este proyecto: modela la estructura en FStructure 2D o genera un pórtico aquí.';
const MODEL3D_MISSING = 'No hay Modelo 3D en este proyecto: modela, genera o trae del 2D la estructura en el modo 3D.';

/** La estructura viene de un modelo del proyecto (2D o un eje del 3D), no del pórtico rápido. */
export const fromProjectModel = (draft: Pick<FrameDraft, 'source'>) => draft.source === 'model' || draft.source === 'model3d';

/** El eje del borrador si sigue en el modelo; si no, el primero. */
const memberIdAt = (result: StructureDesignResult, index: number) => result.members.find((member) => member.index === index)?.id;

/** Las barras de la fuente que forman un elemento diseñado (los tramos de una viga continua, o la columna). */
export function memberIdsOf(result: StructureDesignResult, designId: string): string[] {
  const beam = result.beams.find((item) => item.id === designId);
  const column = beam ? undefined : result.columns.find((item) => item.id === designId);
  const indexes = beam ? beam.memberIndexes : column ? [column.memberIndex] : [];
  return indexes.flatMap((index) => memberIdAt(result, index) ?? []);
}

/** El elemento diseñado (viga o columna) que contiene una barra de la fuente, si se diseña. */
export function designOfMember(result: StructureDesignResult, memberId: string): string | null {
  return result.beams.find((beam) => beam.memberIndexes.some((index) => memberIdAt(result, index) === memberId))?.id
    ?? result.columns.find((column) => memberIdAt(result, column.memberIndex) === memberId)?.id
    ?? null;
}

export const axisOf = (draft: Pick<FrameDraft, 'axis'>, axes: ExternalStructureAxes) =>
  axes.axes.some((item) => item.id === draft.axis) ? draft.axis : axes.axes[0]?.id ?? '';

/** La fuente externa que pide el borrador: el Modelo 2D, un eje del 3D o ninguna (pórtico rápido). */
export function externalFor(draft: Pick<FrameDraft, 'source' | 'axis'>, model2d: ExternalStructureSource | null, axes: ExternalStructureAxes | null): ExternalStructureSource | null {
  if (draft.source === 'model3d') return axes?.axes.length ? axes.source(axisOf(draft, axes)) : null;
  return draft.source === 'model' ? model2d : null;
}

/** Diseña la estructura del borrador con su fuente: el pórtico generado, el Modelo 2D o un eje del 3D. */
export async function designFromDraftAsync(codeId: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[], external: ExternalStructureSource | null, signal: AbortSignal): Promise<StructureOutcome> {
  if (!fromProjectModel(draft) || !external?.designAsync) return designFromDraft(codeId,draft,bays,stories,external);
  const options = { ...structureOptions(codeId,draft,external.fcMpa ?? mpaFromKgcm2(draft.fc)), includeSelfWeight:external.includesSelfWeight };
  const result = await external.designAsync(options,draft.braced === 'yes',signal);
  return result.ok ? {ok:true,result,frame:null} : result;
}

export function designFromDraft(codeId: DesignCodeId, draft: FrameDraft, bays: readonly BayDraft[], stories: readonly StoryDraft[], external?: ExternalStructureSource | null): StructureOutcome {
  if (fromProjectModel(draft)) {
    const missing = draft.source === 'model3d' ? MODEL3D_MISSING : MODEL_MISSING;
    if (!external) return { ok: false, errors: [missing] };
    if (external.errors.length) return { ok: false, errors: external.errors };
    const source = external.create({ braced: draft.braced === 'yes' });
    if (!source) return { ok: false, errors: [missing] };
    const options = { ...structureOptions(codeId, draft, external.fcMpa ?? mpaFromKgcm2(draft.fc)), includeSelfWeight: external.includesSelfWeight };
    const result = designStructure(source, options);
    return result.ok ? { ok: true, result, frame: null } : result;
  }
  const frame = designFrame(frameToInput(codeId, draft, bays, stories));
  return frame.ok ? { ok: true, result: frame, frame } : frame;
}

