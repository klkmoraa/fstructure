import { analyzeFrame, memberActionAt, type FrameAnalysis, type FrameLoadCase, type FrameMember, type FrameModel, type MemberCaseResult } from '../frame/frameAnalysis';
import { buildStations, type BeamAnalysis, type BeamAnalysisOutcome, type CaseResponse } from './beamAnalysis';
import { designBeam, type BeamDesignInput, type BeamDesignResult } from './beam';
import { designCode, isDesignCodeId, type DesignCodeId, type LoadCombination } from './codes';
import { designColumn, momentCapacityAt, type ColumnDesignResult, type ColumnGroup } from './column';
import { CONCRETE_UNIT_WEIGHT_KN_M3, complementary, governingRatio, isPositiveFinite, overallStatus, type ClauseReference, type ElementCheck } from './shared';

/**
 * Pórtico de concreto: vigas y columnas analizadas juntas como un marco plano.
 *
 * El marco se resuelve con `analyzeFrame` (rigidez directa, validada contra el
 * solver 2D) en casos separados: la carga muerta y la viva de cada claro de
 * cada nivel, el peso propio de las columnas y la acción lateral. Con esos
 * casos se arman, por superposición, las envolventes de cada combinación con la
 * viva alternada por claro y nivel, y la lateral en ambos sentidos.
 *
 * - Cada nivel de vigas se diseña con el motor de la viga continua
 *   (`designBeam`), alimentado con la respuesta del marco en lugar de apoyos
 *   ideales; su revisión de servicio vuelve a analizar el marco con las
 *   inercias agrietadas de esa viga.
 * - Cada columna se diseña con el motor de la columna (`designColumn`) en los
 *   estados que maximizan su carga axial, la minimizan y maximizan el momento
 *   en cada sentido, con Pu, M1, M2 y V concurrentes de una misma combinación.
 *   La esbeltez usa la altura libre, el factor k del nomograma (marcos con
 *   desplazamiento) y el índice de estabilidad de cada entrepiso calculado con
 *   la rigidez lateral del propio marco.
 */

export const MAX_FRAME_BAYS = 5;
export const MAX_FRAME_STORIES = 5;
/** Estaciones por miembro para los diagramas del marco. */
const MEMBER_STATIONS = 24;
const TOLERANCE = 1e-9;

export interface FrameStory {
  readonly heightM: number;
  /** Carga de servicio sobre las vigas del nivel, kN/m, sin peso propio. */
  readonly deadKnPerM: number;
  readonly liveKnPerM: number;
  /** Fuerza lateral de diseño en el nivel (sismo ya reducido o viento), kN. */
  readonly lateralKn: number;
}

export interface FrameSection {
  /** Ancho b: perpendicular al plano del marco. */
  readonly widthMm: number;
  /** Peralte h: en el plano del marco. */
  readonly heightMm: number;
}

export interface FrameColumnReinforcement {
  readonly barDiameterMm: number;
  /** Barras por cara b (perpendicular al marco), con esquinas. */
  readonly barsAlongWidth: number;
  /** Barras por cara h (en el plano del marco), con esquinas. */
  readonly barsAlongDepth: number;
  readonly tieDiameterMm: number;
}

export interface FrameDesignInput {
  readonly code: DesignCodeId;
  /** Claros entre ejes de columnas, m. */
  readonly bays: readonly number[];
  /** Niveles de abajo hacia arriba. */
  readonly stories: readonly FrameStory[];
  readonly base: 'fixed' | 'pinned';
  /** Marco arriostrado: cada nivel restringido lateralmente por otro sistema (muros, contravientos). */
  readonly braced: boolean;
  readonly beam: FrameSection;
  readonly column: FrameSection;
  /** Recubrimiento libre hasta el estribo, el mismo en vigas y columnas. */
  readonly coverMm: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly fyStirrupMpa: number;
  readonly maxAggregateMm: number;
  readonly includeSelfWeight: boolean;
  /** Combinaciones gravitacionales de la norma. */
  readonly combinations: readonly LoadCombination[];
  /** Combinaciones con acción lateral; se usan si algún nivel tiene fuerza lateral. */
  readonly lateralCombinations: readonly LoadCombination[];
  readonly lateralReference?: ClauseReference;
  readonly sustainedLiveRatio: number;
  readonly longTermXi: number;
  readonly damagesNonstructural: boolean;
  /** `null` elige el diámetro de las vigas automáticamente. */
  readonly beamBarDiameterMm: number | null;
  readonly stirrupDiameterMm: number | null;
  readonly columnReinforcement: FrameColumnReinforcement;
  readonly group: ColumnGroup;
  /** Factores sobre la inercia bruta para el análisis (1 = sección bruta). */
  readonly beamInertiaFactor: number;
  readonly columnInertiaFactor: number;
  /** k propio de las columnas; `null`: 1.0 si el marco está arriostrado y el del nomograma si no. */
  readonly effectiveLengthFactor: number | null;
}

export type FrameMemberKind = 'beam' | 'column';

/** Miembro del marco con sus envolventes para dibujarlo. */
export interface FrameDiagramMember {
  readonly kind: FrameMemberKind;
  /** Nivel (0 = el primero). */
  readonly story: number;
  /** Claro (vigas) o eje (columnas), desde la izquierda. */
  readonly index: number;
  readonly start: { readonly x: number; readonly y: number };
  readonly end: { readonly x: number; readonly y: number };
  /** Posiciones locales desde el nudo i, m. */
  readonly stations: readonly number[];
  readonly momentMaxKnm: readonly number[];
  readonly momentMinKnm: readonly number[];
  readonly shearMaxKn: readonly number[];
  readonly shearMinKn: readonly number[];
  /** Tensión positiva. */
  readonly axialMaxKn: readonly number[];
  readonly axialMinKn: readonly number[];
  /** Desplazamiento transversal y axial bajo la acción lateral sin factores, m (vacío sin lateral). */
  readonly lateralV: readonly number[];
  readonly lateralU: readonly number[];
  /** Desplazamientos de servicio (CM + CV) sin factores, m. */
  readonly serviceV: readonly number[];
  readonly serviceU: readonly number[];
  /** Cociente demanda/capacidad que rige en el miembro. */
  readonly ratio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

export interface FrameColumnState {
  readonly label: string;
  readonly combination: string;
  /** Compresión positiva. */
  readonly axialKn: number;
  /** Momentos totales en los extremos (convención de diagrama: positivo con tensión en la cara derecha). */
  readonly topKnm: number;
  readonly bottomKnm: number;
  /** Parte por desplazamiento lateral (acción lateral) en el extremo que rige. */
  readonly swayKnm: number;
  readonly nonSwayKnm: number;
  readonly shearKn: number;
  readonly sustainedRatio: number;
  readonly stabilityIndex: number;
  /** Momento de diseño en el plano con mínimos y amplificaciones. */
  readonly designMomentKnm: number;
  readonly ratio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

export interface FrameColumnDesign {
  readonly line: number;
  readonly story: number;
  readonly result: ColumnDesignResult;
  readonly states: readonly FrameColumnState[];
  readonly governingState: number;
  readonly effectiveLengthFactor: number;
  /** ψ en los extremos (nomograma); `null` en la base empotrada o articulada. */
  readonly psiTop: number;
  readonly psiBottom: number;
}

export interface FrameBeamDesign {
  readonly story: number;
  readonly result: BeamDesignResult;
  /** Cociente que rige en cada claro: flexión, cortante y flecha de ese tramo. */
  readonly bayRatios: readonly number[];
}

export interface FrameStoryResult {
  readonly story: number;
  /** Cortante del entrepiso bajo la acción lateral, kN. */
  readonly shearKn: number;
  /** Desplazamiento relativo del entrepiso con la acción lateral sin factores, mm. */
  readonly driftMm: number;
  readonly driftRatio: number;
  /** Rigidez lateral del entrepiso del análisis elástico, kN/m. */
  readonly stiffnessKnPerM: number;
  /** Índice de estabilidad mayor entre las combinaciones (0 si el marco está arriostrado). */
  readonly stabilityIndex: number;
  /** Carga vertical factorizada del entrepiso que lo produce, kN. */
  readonly verticalLoadKn: number;
}

export interface FrameJoint {
  readonly line: number;
  /** Nivel del nudo (1 = sobre el primer entrepiso). */
  readonly level: number;
  readonly columnsKnm: number;
  readonly beamsKnm: number;
  readonly ratio: number;
}

export interface FrameDesignResult {
  readonly ok: true;
  readonly input: FrameDesignInput;
  readonly nodes: readonly { readonly x: number; readonly y: number }[];
  readonly members: readonly FrameDiagramMember[];
  readonly beams: readonly FrameBeamDesign[];
  readonly columns: readonly FrameColumnDesign[];
  readonly stories: readonly FrameStoryResult[];
  readonly joints: readonly FrameJoint[];
  readonly lateral: boolean;
  readonly selfWeight: { readonly beamKnPerM: number; readonly columnKnPerM: number };
  /** Casos de carga resueltos en el análisis con secciones brutas. */
  readonly loadCases: number;
  readonly combinations: readonly LoadCombination[];
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

interface FrameDesignError { readonly ok: false; readonly errors: readonly string[] }

function validate(input: FrameDesignInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  if (input.bays.length < 1 || input.bays.length > MAX_FRAME_BAYS) errors.push(`El pórtico debe tener entre 1 y ${MAX_FRAME_BAYS} claros.`);
  if (input.stories.length < 1 || input.stories.length > MAX_FRAME_STORIES) errors.push(`El pórtico debe tener entre 1 y ${MAX_FRAME_STORIES} niveles.`);
  input.bays.forEach((length, index) => { if (!isPositiveFinite(length)) errors.push(`Claro ${index + 1}: la longitud debe ser mayor que cero.`); });
  input.stories.forEach((story, index) => {
    if (!isPositiveFinite(story.heightM)) errors.push(`Nivel ${index + 1}: la altura debe ser mayor que cero.`);
    for (const [key, label] of [['deadKnPerM', 'carga muerta'], ['liveKnPerM', 'carga viva'], ['lateralKn', 'fuerza lateral']] as const) {
      if (!Number.isFinite(story[key]) || story[key] < 0) errors.push(`Nivel ${index + 1}: la ${label} debe ser cero o positiva.`);
    }
  });
  const positive: [number, string][] = [
    [input.beam.widthMm, 'Base de la viga'], [input.beam.heightMm, 'Peralte de la viga'],
    [input.column.widthMm, 'Base b de la columna'], [input.column.heightMm, 'Peralte h de la columna'],
    [input.coverMm, 'Recubrimiento'], [input.fcMpa, "f'c"], [input.fyMpa, 'fy'], [input.fyStirrupMpa, 'fy de estribos'],
    [input.maxAggregateMm, 'Agregado máximo'], [input.beamInertiaFactor, 'Factor de inercia de vigas'], [input.columnInertiaFactor, 'Factor de inercia de columnas'],
  ];
  for (const [value, label] of positive) if (!isPositiveFinite(value)) errors.push(`${label} debe ser mayor que cero.`);
  if (input.beamInertiaFactor > 1 || input.columnInertiaFactor > 1) errors.push('Los factores de inercia van de 0 a 1.');
  if (input.effectiveLengthFactor !== null && !isPositiveFinite(input.effectiveLengthFactor)) errors.push('El factor k propio debe ser mayor que cero.');
  if (input.combinations.length < 1) errors.push('Se requiere al menos una combinación de carga.');
  if (errors.length) return errors;
  const shortest = Math.min(...input.stories.map((story) => story.heightM));
  if (shortest * 1e3 <= input.beam.heightMm + 100) errors.push('La altura de entrepiso no deja altura libre a las columnas con ese peralte de viga.');
  return errors;
}

/** Índices del modelo: nudos por nivel y eje, columnas y vigas. */
interface FrameLayout {
  readonly lines: number;
  readonly levels: number;
  readonly node: (line: number, level: number) => number;
  readonly column: (line: number, story: number) => number;
  readonly beam: (bay: number, story: number) => number;
  readonly xs: readonly number[];
  readonly ys: readonly number[];
}

function layoutOf(input: FrameDesignInput): FrameLayout {
  const lines = input.bays.length + 1;
  const levels = input.stories.length + 1;
  const xs = [0];
  input.bays.forEach((length) => xs.push(xs[xs.length - 1]! + length));
  const ys = [0];
  input.stories.forEach((story) => ys.push(ys[ys.length - 1]! + story.heightM));
  const columns = lines * input.stories.length;
  return {
    lines, levels, xs, ys,
    node: (line, level) => level * lines + line,
    column: (line, story) => story * lines + line,
    beam: (bay, story) => columns + story * input.bays.length + bay,
  };
}

const sectionInertia = (section: FrameSection) => section.widthMm * section.heightMm ** 3 / 12 / 1e12;
const sectionArea = (section: FrameSection) => section.widthMm * section.heightMm / 1e6;

function buildModel(input: FrameDesignInput, layout: FrameLayout, beamInertias?: { story: number; inertiasM4: readonly number[] }): FrameModel {
  const e = designCode(input.code).elasticModulusMpa(input.fcMpa) * 1e3;
  const nodes = layout.ys.flatMap((y, level) => layout.xs.map((x, line) => ({
    x,
    y,
    restraint: level === 0
      ? [true, true, input.base === 'fixed'] as const
      : [input.braced && line === 0, false, false] as const,
  })));
  const members: FrameMember[] = [];
  const columnMember = { elasticModulusKpa: e, areaM2: sectionArea(input.column), inertiaM4: sectionInertia(input.column) * input.columnInertiaFactor };
  input.stories.forEach((_, story) => {
    for (let line = 0; line < layout.lines; line += 1) members.push({ i: layout.node(line, story), j: layout.node(line, story + 1), ...columnMember });
  });
  const beamInertia = sectionInertia(input.beam) * input.beamInertiaFactor;
  input.stories.forEach((_, story) => {
    input.bays.forEach((__, bay) => members.push({
      i: layout.node(bay, story + 1),
      j: layout.node(bay + 1, story + 1),
      elasticModulusKpa: e,
      areaM2: sectionArea(input.beam),
      inertiaM4: beamInertias?.story === story ? beamInertias.inertiasM4[bay]! : beamInertia,
    }));
  });
  return { nodes, members };
}

interface CaseSet {
  readonly cases: FrameLoadCase[];
  readonly dead: number[];
  readonly live: number[];
  /** Carga muerta y viva de cada claro y nivel, por índice de caso. */
  readonly deadOf: (bay: number, story: number) => number;
  readonly liveOf: (bay: number, story: number) => number;
  readonly lateral: number | null;
  /** Una fuerza unitaria por nivel: rigidez lateral de cada entrepiso. */
  readonly probe: number | null;
}

function buildCases(input: FrameDesignInput, layout: FrameLayout, selfWeight: { beam: number; column: number }, lateral: boolean): CaseSet {
  const cases: FrameLoadCase[] = [];
  const dead: number[] = [];
  const live: number[] = [];
  const deadIndex = new Map<string, number>();
  const liveIndex = new Map<string, number>();
  input.stories.forEach((story, s) => input.bays.forEach((_, bay) => {
    const member = layout.beam(bay, s);
    deadIndex.set(`${bay}-${s}`, cases.length);
    dead.push(cases.length);
    cases.push({ id: `D-${bay}-${s}`, gravity: { [member]: story.deadKnPerM + selfWeight.beam } });
    liveIndex.set(`${bay}-${s}`, cases.length);
    live.push(cases.length);
    cases.push({ id: `L-${bay}-${s}`, gravity: { [member]: story.liveKnPerM } });
  }));
  if (selfWeight.column > 0) {
    const gravity: Record<number, number> = {};
    input.stories.forEach((_, s) => { for (let line = 0; line < layout.lines; line += 1) gravity[layout.column(line, s)] = selfWeight.column; });
    dead.push(cases.length);
    cases.push({ id: 'D-col', gravity });
  }
  // Fuerza de cada nivel repartida entre sus nudos (diafragma rígido).
  const atLevel = (force: (story: number) => number) => input.stories.flatMap((_, s) =>
    layout.xs.map((__, line) => ({ node: layout.node(line, s + 1), fx: force(s) / layout.lines, fy: 0 })));
  let lateralCase: number | null = null;
  if (lateral) {
    lateralCase = cases.length;
    cases.push({ id: 'E', nodal: atLevel((s) => input.stories[s]!.lateralKn) });
  }
  let probe: number | null = null;
  if (!input.braced) {
    probe = cases.length;
    cases.push({ id: 'probe', nodal: atLevel(() => 1) });
  }
  return {
    cases, dead, live, lateral: lateralCase, probe,
    deadOf: (bay, story) => deadIndex.get(`${bay}-${story}`)!,
    liveOf: (bay, story) => liveIndex.get(`${bay}-${story}`)!,
  };
}

/** Superpone casos en una combinación eligiendo, caso por caso, el factor que maximiza `score`. */
function superpose(
  values: (caseIndex: number) => number,
  set: CaseSet,
  factors: LoadCombination,
  lateralSign: number,
  direction: 1 | -1,
): { total: number; dead: number; live: number; lateral: number; picks: { dead: number[]; live: number[] } } {
  let deadTotal = 0;
  let liveTotal = 0;
  const deadPicks: number[] = [];
  const livePicks: number[] = [];
  for (const index of set.dead) {
    const value = values(index);
    const factor = direction * value >= 0 ? factors.dead : factors.favorableDead;
    deadPicks.push(factor);
    deadTotal += factor * value;
  }
  for (const index of set.live) {
    const value = values(index);
    const factor = direction * value > 0 ? factors.live : 0;
    livePicks.push(factor);
    liveTotal += factor * value;
  }
  const lateral = set.lateral !== null && factors.lateral ? lateralSign * factors.lateral * values(set.lateral) : 0;
  return { total: deadTotal + liveTotal + lateral, dead: deadTotal, live: liveTotal, lateral, picks: { dead: deadPicks, live: livePicks } };
}

/** Aplica factores ya elegidos a otra cantidad del mismo estado. */
function applyPicks(values: (caseIndex: number) => number, set: CaseSet, picks: { dead: number[]; live: number[] }, factors: LoadCombination, lateralSign: number) {
  let dead = 0;
  let live = 0;
  set.dead.forEach((index, position) => { dead += picks.dead[position]! * values(index); });
  set.live.forEach((index, position) => { live += picks.live[position]! * values(index); });
  const lateral = set.lateral !== null && factors.lateral ? lateralSign * factors.lateral * values(set.lateral) : 0;
  return { total: dead + live + lateral, dead, live, lateral };
}

/**
 * Factor de longitud efectiva de una columna de marco con desplazamiento
 * lateral (nomograma de Jackson y Moreland):
 * (ψAψB(π/k)² − 36)/(6(ψA + ψB)) = (π/k)/tan(π/k), con k ≥ 1.
 */
export function swayEffectiveLengthFactor(psiA: number, psiB: number): number {
  const a = Math.max(psiA, 1e-6);
  const b = Math.max(psiB, 1e-6);
  const f = (k: number) => {
    const x = Math.PI / k;
    return (a * b * x ** 2 - 36) / (6 * (a + b)) - x / Math.tan(x);
  };
  // En k → 1⁺, (π/k)/tan(π/k) → −∞ y f → +∞; con k → ∞, f → −6/(ψA + ψB) − 1 < 0: una sola raíz.
  let low = 1 + 1e-9;
  let high = 2;
  while (f(high) > 0 && high < 1e3) high *= 2;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (low + high) / 2;
    if (f(middle) > 0) low = middle; else high = middle;
  }
  return (low + high) / 2;
}

const COMBINATION_SIGNS = (combination: LoadCombination, lateral: boolean) =>
  lateral && combination.lateral ? [1, -1] : [0];

const signLabel = (combination: LoadCombination, sign: number) =>
  sign === 0 ? combination.label : `${combination.label.replace(/\s*±\s*/, sign > 0 ? ' + ' : ' − ')}${sign > 0 ? ' (→)' : ' (←)'}`;

export function designFrame(input: FrameDesignInput): FrameDesignResult | FrameDesignError {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };
  const code = designCode(input.code);
  const layout = layoutOf(input);
  const lateral = !input.braced && input.stories.some((story) => story.lateralKn > 0);
  const combinations = lateral ? [...input.combinations, ...input.lateralCombinations] : input.combinations;
  const selfWeight = input.includeSelfWeight
    ? { beam: CONCRETE_UNIT_WEIGHT_KN_M3 * sectionArea(input.beam), column: CONCRETE_UNIT_WEIGHT_KN_M3 * sectionArea(input.column) }
    : { beam: 0, column: 0 };
  const set = buildCases(input, layout, selfWeight, lateral);
  const model = buildModel(input, layout);
  const outcome = analyzeFrame(model, set.cases);
  if (!outcome.ok) return { ok: false, errors: [outcome.error] };
  const analysis = outcome.analysis;

  // Entrepisos: rigidez lateral, deriva con la acción lateral e índice de estabilidad.
  const mean = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const levelUx = (frameAnalysis: FrameAnalysis, caseIndex: number, level: number) =>
    mean(layout.xs.map((_, line) => frameAnalysis.cases[caseIndex]!.nodeDisplacements[layout.node(line, level)]![0]));
  const columnAction = (caseIndex: number, line: number, story: number, x: number) => {
    const index = layout.column(line, story);
    return memberActionAt(model.members[index]!, analysis.geometry[index]!.lengthM, analysis.cases[caseIndex]!.members[index]!, x);
  };
  // ΣPu del entrepiso con la viva en todos los claros: compresión en la base de sus columnas.
  const verticalLoad = (story: number, combination: LoadCombination) => {
    let total = 0;
    for (let line = 0; line < layout.lines; line += 1) {
      const compression = (caseIndex: number) => -columnAction(caseIndex, line, story, 0).axial;
      total += set.dead.reduce((sum, index) => sum + combination.dead * compression(index), 0)
        + set.live.reduce((sum, index) => sum + combination.live * compression(index), 0);
    }
    return total;
  };
  const stories: FrameStoryResult[] = input.stories.map((story, s) => {
    const storyShear = input.stories.slice(s).reduce((total, item) => total + item.lateralKn, 0);
    const drift = lateral && set.lateral !== null ? levelUx(analysis, set.lateral, s + 1) - levelUx(analysis, set.lateral, s) : 0;
    const probeDrift = set.probe !== null ? levelUx(analysis, set.probe, s + 1) - levelUx(analysis, set.probe, s) : 0;
    const probeShear = input.stories.length - s;
    const stiffness = probeDrift > TOLERANCE ? probeShear / probeDrift : Number.POSITIVE_INFINITY;
    const indexes = combinations.map((combination) => {
      const vertical = verticalLoad(s, combination);
      return { vertical, q: input.braced || !Number.isFinite(stiffness) ? 0 : vertical / (stiffness * story.heightM) };
    });
    const worst = indexes.reduce((best, item) => (item.q > best.q ? item : best), indexes[0]!);
    return {
      story: s,
      shearKn: storyShear,
      driftMm: drift * 1e3,
      driftRatio: drift / story.heightM,
      stiffnessKnPerM: stiffness,
      stabilityIndex: worst.q,
      verticalLoadKn: worst.vertical,
    };
  });
  const stabilityFor = (story: number, combination: LoadCombination) => {
    const stiffness = stories[story]!.stiffnessKnPerM;
    return input.braced || !Number.isFinite(stiffness) ? 0 : verticalLoad(story, combination) / (stiffness * input.stories[story]!.heightM);
  };

  // Vigas: cada nivel con el motor de la viga continua y la respuesta del marco.
  const beamSpans = input.bays.map((lengthM) => ({ lengthM, deadKnPerM: 0, liveKnPerM: 0, pointDeadKn: 0, pointLiveKn: 0, pointAtM: lengthM / 2 }));
  const beamStations = buildStations({ spans: beamSpans });
  const sampleBeam = (frameModel: FrameModel, frameAnalysis: FrameAnalysis, story: number, caseIndex: number): CaseResponse => {
    const moment: number[] = [];
    const shear: number[] = [];
    const deflection: number[] = [];
    for (const station of beamStations) {
      const index = layout.beam(station.span, story);
      const action = memberActionAt(frameModel.members[index]!, frameAnalysis.geometry[index]!.lengthM, frameAnalysis.cases[caseIndex]!.members[index]!, station.local);
      moment.push(action.moment);
      shear.push(action.shear);
      deflection.push(action.v);
    }
    return { moment, shear, deflection };
  };
  const beamAnalysisOf = (frameModel: FrameModel, frameAnalysis: FrameAnalysis, story: number): BeamAnalysis => ({
    stations: beamStations.map((station) => station.x),
    stationSpan: beamStations.map((station) => station.span),
    nodesAtM: layout.xs,
    totalLengthM: layout.xs[layout.xs.length - 1]!,
    deadPerSpan: set.dead.map((caseIndex) => sampleBeam(frameModel, frameAnalysis, story, caseIndex)),
    livePerSpan: set.live.map((caseIndex) => sampleBeam(frameModel, frameAnalysis, story, caseIndex)),
    ...(set.lateral !== null ? { lateral: sampleBeam(frameModel, frameAnalysis, story, set.lateral) } : {}),
    solverRuns: set.cases.length,
  });
  const beams: FrameBeamDesign[] = [];
  for (let story = 0; story < input.stories.length; story += 1) {
    const level = input.stories[story]!;
    const beamInput: BeamDesignInput = {
      code: input.code,
      widthMm: input.beam.widthMm,
      heightMm: input.beam.heightMm,
      coverMm: input.coverMm,
      fcMpa: input.fcMpa,
      fyMpa: input.fyMpa,
      fyStirrupMpa: input.fyStirrupMpa,
      spans: input.bays.map((lengthM) => ({ lengthM, deadKnPerM: level.deadKnPerM, liveKnPerM: level.liveKnPerM, pointDeadKn: 0, pointLiveKn: 0, pointAtM: lengthM / 2 })),
      leftEnd: 'fixed',
      rightEnd: 'fixed',
      includeSelfWeight: input.includeSelfWeight,
      combinations,
      sustainedLiveRatio: input.sustainedLiveRatio,
      longTermXi: input.longTermXi,
      barDiameterMm: input.beamBarDiameterMm,
      stirrupDiameterMm: input.stirrupDiameterMm,
      maxAggregateMm: input.maxAggregateMm,
      damagesNonstructural: input.damagesNonstructural,
      supportWidthMm: input.column.heightMm,
      flange: null,
      provided: null,
    };
    const provider = (inertias?: readonly number[]): BeamAnalysisOutcome => {
      if (!inertias) return { ok: true, analysis: beamAnalysisOf(model, analysis, story) };
      const crackedModel = buildModel(input, layout, { story, inertiasM4: inertias });
      const cracked = analyzeFrame(crackedModel, set.cases);
      if (!cracked.ok) return { ok: false, error: cracked.error };
      return { ok: true, analysis: beamAnalysisOf(crackedModel, cracked.analysis, story) };
    };
    const result = designBeam(beamInput, { analyze: provider, demandSource: `Pórtico · nivel ${story + 1}` });
    if (!result.ok) return { ok: false, errors: result.errors.map((error) => `Viga del nivel ${story + 1}: ${error}`) };
    const bayRatios = input.bays.map((_, bay) => {
      let worst = 0;
      result.diagram.xM.forEach((x, index) => {
        if (result.spans[bay]!.startM - TOLERANCE > x || x > result.spans[bay]!.startM + result.spans[bay]!.lengthM + TOLERANCE) return;
        const positive = Math.max(0, result.diagram.momentMaxKnm[index]!) / Math.max(result.diagram.capacityPositiveKnm[index]!, TOLERANCE);
        const negative = Math.max(0, -result.diagram.momentMinKnm[index]!) / Math.max(-result.diagram.capacityNegativeKnm[index]!, TOLERANCE);
        const shear = Math.max(Math.abs(result.diagram.shearMaxKn[index]!), Math.abs(result.diagram.shearMinKn[index]!)) / Math.max(result.diagram.shearCapacityKn[index]!, TOLERANCE);
        worst = Math.max(worst, positive, negative, shear);
      });
      const span = result.spans[bay]!;
      return Math.max(worst, span.checkedDeflectionMm / span.deflectionLimitMm);
    });
    beams.push({ story, result, bayRatios });
  }

  // Columnas: estados concurrentes por combinación y diseño con el motor de columnas.
  const e = designCode(input.code).elasticModulusMpa(input.fcMpa);
  const columnStiffness = (story: number) => e * sectionInertia(input.column) * input.columnInertiaFactor / input.stories[story]!.heightM;
  const beamStiffness = e * sectionInertia(input.beam) * input.beamInertiaFactor;
  const psiAt = (line: number, level: number) => {
    if (level === 0) return input.base === 'fixed' ? 1 : 10;
    const columns = columnStiffness(level - 1) + (level < input.stories.length ? columnStiffness(level) : 0);
    const beamsAtJoint = (line > 0 ? beamStiffness / input.bays[line - 1]! : 0) + (line < input.bays.length ? beamStiffness / input.bays[line]! : 0);
    return columns / beamsAtJoint;
  };
  const columns: FrameColumnDesign[] = [];
  type StateDraft = Omit<FrameColumnState, 'ratio' | 'status' | 'designMomentKnm'> & { result: ColumnDesignResult };
  for (let story = 0; story < input.stories.length; story += 1) {
    const height = input.stories[story]!.heightM;
    for (let line = 0; line < layout.lines; line += 1) {
      const length = analysis.geometry[layout.column(line, story)]!.lengthM;
      const at = (caseIndex: number, x: number) => columnAction(caseIndex, line, story, x);
      const axial = (caseIndex: number) => -at(caseIndex, 0).axial;
      const top = (caseIndex: number) => at(caseIndex, length).moment;
      const bottom = (caseIndex: number) => at(caseIndex, 0).moment;
      const shear = (caseIndex: number) => at(caseIndex, 0).shear;
      const psiTop = psiAt(line, story + 1);
      const psiBottom = psiAt(line, story);
      const k = input.effectiveLengthFactor ?? (input.braced ? 1 : swayEffectiveLengthFactor(psiTop, psiBottom));
      const states: StateDraft[] = [];
      const seen = new Set<string>();
      for (const combination of combinations) {
        const q = stabilityFor(story, combination);
        for (const sign of COMBINATION_SIGNS(combination, lateral)) {
          const candidates: { label: string; values: (index: number) => number; direction: 1 | -1 }[] = [
            { label: 'Pu máx.', values: axial, direction: 1 },
            { label: 'Pu mín.', values: axial, direction: -1 },
          ];
          // Momento máximo en cada sentido: el extremo que más crece con la viva alternada.
          for (const direction of [1, -1] as const) {
            const atTop = superpose(top, set, combination, sign, direction).total * direction;
            const atBottom = superpose(bottom, set, combination, sign, direction).total * direction;
            candidates.push({ label: direction > 0 ? 'M máx. (+)' : 'M máx. (−)', values: atTop >= atBottom ? top : bottom, direction });
          }
          for (const candidate of candidates) {
            const chosen = superpose(candidate.values, set, combination, sign, candidate.direction);
            const p = applyPicks(axial, set, chosen.picks, combination, sign);
            const mt = applyPicks(top, set, chosen.picks, combination, sign);
            const mb = applyPicks(bottom, set, chosen.picks, combination, sign);
            const v = applyPicks(shear, set, chosen.picks, combination, sign);
            const key = [p.total, mt.total, mb.total].map((value) => value.toFixed(3)).join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            const topGoverns = Math.abs(mt.total) >= Math.abs(mb.total);
            const m2 = topGoverns ? mt : mb;
            const m1 = topGoverns ? mb : mt;
            const ratio = Math.abs(m2.total) > TOLERANCE ? Math.min(1, Math.abs(m1.total) / Math.abs(m2.total)) : 1;
            const nonSway = m2.dead + m2.live;
            const sustained = p.total > TOLERANCE
              ? Math.min(1, Math.max(0, (p.dead + input.sustainedLiveRatio * p.live) / p.total))
              : 0;
            const source = `Pórtico · ${signLabel(combination, sign)} · ${candidate.label}`;
            const result = designColumn({
              code: input.code,
              widthMm: input.column.widthMm,
              depthMm: input.column.heightMm,
              coverMm: input.coverMm,
              fcMpa: input.fcMpa,
              fyMpa: input.fyMpa,
              barDiameterMm: input.columnReinforcement.barDiameterMm,
              barsAlongWidth: input.columnReinforcement.barsAlongWidth,
              barsAlongDepth: input.columnReinforcement.barsAlongDepth,
              tieDiameterMm: input.columnReinforcement.tieDiameterMm,
              maxAggregateMm: input.maxAggregateMm,
              axialKn: p.total,
              momentXKnm: input.braced ? Math.abs(m2.total) : Math.abs(nonSway),
              momentYKnm: 0,
              shearXKn: 0,
              shearYKn: Math.abs(v.total),
              unbracedLengthM: Math.max(0.1, height - input.beam.heightMm / 1e3),
              effectiveLengthFactor: input.braced ? k : Math.max(1, k),
              curvature: mt.total * mb.total > 0 ? 'single' : 'double',
              endMomentRatio: ratio,
              sustainedRatio: sustained,
              braced: input.braced,
              swayMomentXKnm: input.braced ? 0 : Math.abs(m2.lateral),
              swayMomentYKnm: 0,
              stabilityIndex: q,
              group: input.group,
              groundFloor: story === 0 && lateral,
            }, { demandSource: source });
            if (!result.ok) return { ok: false, errors: result.errors.map((error) => `Columna del eje ${line + 1}, nivel ${story + 1}: ${error}`) };
            states.push({
              label: candidate.label,
              combination: signLabel(combination, sign),
              axialKn: p.total,
              topKnm: mt.total,
              bottomKnm: mb.total,
              swayKnm: m2.lateral,
              nonSwayKnm: nonSway,
              shearKn: v.total,
              sustainedRatio: sustained,
              stabilityIndex: q,
              result,
            });
          }
        }
      }
      const severity = (status: 'pass' | 'fail' | 'warning') => (status === 'fail' ? 2 : status === 'warning' ? 1 : 0);
      const governingState = states.reduce((best, state, index) => {
        const current = states[best]!;
        return severity(state.result.status) > severity(current.result.status)
          || (severity(state.result.status) === severity(current.result.status) && state.result.governingRatio > current.result.governingRatio) ? index : best;
      }, 0);
      columns.push({
        line,
        story,
        result: states[governingState]!.result,
        states: states.map(({ result, ...state }) => ({ ...state, designMomentKnm: result.magnification.x.designMomentKnm, ratio: result.governingRatio, status: result.status })),
        governingState,
        effectiveLengthFactor: input.braced ? k : Math.max(1, k),
        psiTop,
        psiBottom,
      });
    }
  }

  // Nudos: relación de resistencias de diseño columnas/vigas (informativa).
  const joints: FrameJoint[] = [];
  for (let level = 1; level < input.stories.length; level += 1) {
    const beam = beams[level - 1]!.result;
    for (let line = 0; line < layout.lines; line += 1) {
      const columnStrength = (story: number) => {
        const design = columns.find((item) => item.line === line && item.story === story)!;
        return momentCapacityAt(design.result.aboutX.design, design.states[design.governingState]!.axialKn);
      };
      const x = layout.xs[line]!;
      const index = beam.diagram.xM.findIndex((value) => Math.abs(value - x) < 1e-6);
      if (index < 0) continue;
      const positive = beam.diagram.capacityPositiveKnm[index]!;
      const negative = -beam.diagram.capacityNegativeKnm[index]!;
      const sides = (line > 0 ? 1 : 0) + (line < input.bays.length ? 1 : 0);
      const beamsKnm = sides === 2 ? positive + negative : Math.max(positive, negative);
      const columnsKnm = columnStrength(level - 1) + columnStrength(level);
      joints.push({ line, level, columnsKnm, beamsKnm, ratio: columnsKnm / beamsKnm });
    }
  }

  // Envolventes de cada miembro para dibujar el marco.
  const statusOf = (ratio: number): 'pass' | 'fail' | 'warning' => (ratio > 1 + 1e-9 ? 'fail' : 'pass');
  const members: FrameDiagramMember[] = model.members.map((member, index) => {
    const isColumn = index < layout.lines * input.stories.length;
    const story = isColumn ? Math.floor(index / layout.lines) : Math.floor((index - layout.lines * input.stories.length) / input.bays.length);
    const position = isColumn ? index % layout.lines : (index - layout.lines * input.stories.length) % input.bays.length;
    const geometry = analysis.geometry[index]!;
    const stations = Array.from({ length: MEMBER_STATIONS + 1 }, (_, step) => geometry.lengthM * step / MEMBER_STATIONS);
    const sampled = analysis.cases.map((caseResult: { members: readonly MemberCaseResult[] }) => stations.map((x) => memberActionAt(member, geometry.lengthM, caseResult.members[index]!, x)));
    const envelope = (pick: (action: ReturnType<typeof memberActionAt>) => number) => {
      const max: number[] = [];
      const min: number[] = [];
      stations.forEach((_, s) => {
        const values = (caseIndex: number) => pick(sampled[caseIndex]![s]!);
        let high = Number.NEGATIVE_INFINITY;
        let low = Number.POSITIVE_INFINITY;
        for (const combination of combinations) {
          for (const sign of COMBINATION_SIGNS(combination, lateral)) {
            high = Math.max(high, superpose(values, set, combination, sign, 1).total);
            low = Math.min(low, superpose(values, set, combination, sign, -1).total);
          }
        }
        max.push(high);
        min.push(low);
      });
      return { max, min };
    };
    const moment = envelope((action) => action.moment);
    const shear = envelope((action) => action.shear);
    const axialEnvelope = envelope((action) => action.axial);
    // Servicio: toda la muerta y toda la viva, sin factores.
    const sumCases = (pick: (action: ReturnType<typeof memberActionAt>) => number) => stations.map((_, s) =>
      [...set.dead, ...set.live].reduce((total, caseIndex) => total + pick(sampled[caseIndex]![s]!), 0));
    const ratio = isColumn
      ? columns.find((item) => item.line === position && item.story === story)!.states.reduce((worst, state) => Math.max(worst, state.ratio), 0)
      : beams[story]!.bayRatios[position]!;
    const columnStatus = isColumn ? columns.find((item) => item.line === position && item.story === story)!.result.status : null;
    return {
      kind: isColumn ? 'column' : 'beam',
      story,
      index: position,
      start: { x: model.nodes[member.i]!.x, y: model.nodes[member.i]!.y },
      end: { x: model.nodes[member.j]!.x, y: model.nodes[member.j]!.y },
      stations,
      momentMaxKnm: moment.max,
      momentMinKnm: moment.min,
      shearMaxKn: shear.max,
      shearMinKn: shear.min,
      axialMaxKn: axialEnvelope.max,
      axialMinKn: axialEnvelope.min,
      lateralV: set.lateral !== null ? sampled[set.lateral]!.map((action) => action.v) : [],
      lateralU: set.lateral !== null ? sampled[set.lateral]!.map((action) => action.u) : [],
      serviceV: sumCases((action) => action.v),
      serviceU: sumCases((action) => action.u),
      ratio,
      status: columnStatus ?? statusOf(ratio),
    };
  });

  // Comprobaciones del pórtico: una por miembro (lo que rige) y las del conjunto.
  const governingCheck = (checks: readonly ElementCheck[]) => {
    const failing = checks.filter((check) => check.status === 'fail');
    const pool = failing.length ? failing : checks.filter((check) => check.ratio !== undefined && Number.isFinite(check.ratio));
    return pool.reduce<ElementCheck | undefined>((best, check) => (!best || (check.ratio ?? 0) > (best.ratio ?? 0) ? check : best), undefined) ?? checks[0]!;
  };
  const memberChecks: ElementCheck[] = [
    ...beams.map((beam): ElementCheck => {
      const rule = governingCheck(beam.result.checks);
      return {
        id: `beam-${beam.story + 1}`,
        label: `Viga del nivel ${beam.story + 1}`,
        status: beam.result.status,
        ratio: beam.result.governingRatio,
        demand: beam.result.governingRatio,
        capacity: 1,
        unit: '',
        reference: rule.reference,
        note: `Rige: ${rule.label.toLowerCase()}${rule.note ? ` — ${rule.note}` : ''}`,
        location: `Nivel ${beam.story + 1}${rule.location ? ` · ${rule.location}` : ''}`,
        combination: rule.combination ?? `Pórtico · envolvente`,
      };
    }),
    ...columns.map((column): ElementCheck => {
      const rule = governingCheck(column.result.checks);
      const state = column.states[column.governingState]!;
      return {
        id: `column-${column.line + 1}-${column.story + 1}`,
        label: `Columna del eje ${column.line + 1}, nivel ${column.story + 1}`,
        status: column.result.status,
        ratio: column.result.governingRatio,
        demand: column.result.governingRatio,
        capacity: 1,
        unit: '',
        reference: rule.reference,
        note: `Rige: ${rule.label.toLowerCase()} con Pu = ${state.axialKn.toFixed(0)} kN, M = ${Math.max(Math.abs(state.topKnm), Math.abs(state.bottomKnm)).toFixed(1)} kN·m · k = ${column.effectiveLengthFactor.toFixed(2)}${rule.note ? ` — ${rule.note}` : ''}`,
        location: `Eje ${column.line + 1} · nivel ${column.story + 1}`,
        combination: `Pórtico · ${state.combination} · ${state.label}`,
      };
    }),
  ];
  const refs = code.refs;
  const frameChecks: ElementCheck[] = [
    {
      id: 'load-factors',
      label: 'Combinaciones de carga',
      status: 'info',
      reference: refs.loadFactors,
      note: `${input.combinations.map((item) => item.label).join(' · ')}; viva alternada por claro y nivel (nula donde favorece)${code.usesStructureGroup ? `; ${input.combinations[0]!.favorableDead} en la muerta donde favorece` : ''}.`,
    },
  ];
  if (lateral) {
    frameChecks.push({
      id: 'lateral-combinations',
      label: 'Combinaciones con acción lateral',
      status: 'info',
      reference: input.lateralReference ?? complementary('Factores capturados'),
      note: `${input.lateralCombinations.map((item) => item.label).join(' · ')}, en ambos sentidos. ${code.lateralCombinations('B').note}`,
    });
    const worstDrift = stories.reduce((best, story) => (story.driftRatio > best.driftRatio ? story : best), stories[0]!);
    frameChecks.push({
      id: 'drift',
      label: 'Deriva de entrepiso',
      status: 'info',
      reference: complementary('Análisis elástico con las fuerzas capturadas'),
      note: `Máxima en el nivel ${worstDrift.story + 1}: Δ/h = ${worstDrift.driftRatio.toFixed(4)} (${worstDrift.driftMm.toFixed(1)} mm). Es elástica con las fuerzas capturadas: amplifícala según la norma de sismo antes de compararla con su límite.`,
    });
  }
  if (!input.braced) {
    const worst = stories.reduce((best, story) => (story.stabilityIndex > best.stabilityIndex ? story : best), stories[0]!);
    frameChecks.push({
      id: 'stability-index',
      label: code.id === 'ntc-2023' ? 'Índice de estabilidad λest' : 'Índice de estabilidad Q',
      status: 'info',
      reference: refs.sway,
      note: `Mayor en el nivel ${worst.story + 1}: ${worst.stabilityIndex.toFixed(3)} = ΣPu·Δ/(V·h) con ΣPu = ${worst.verticalLoadKn.toFixed(0)} kN y la rigidez lateral del análisis (${(worst.stiffnessKnPerM).toFixed(0)} kN/m); δs se aplica a los momentos por desplazamiento.`,
    });
    frameChecks.push({
      id: 'effective-length',
      label: 'Longitud efectiva k',
      status: 'info',
      reference: input.effectiveLengthFactor === null ? complementary('Nomograma de Jackson y Moreland') : complementary('Factor capturado'),
      note: input.effectiveLengthFactor === null
        ? `k del nomograma con ψ = Σ(EI/L) columnas / Σ(EI/L) vigas (base empotrada ψ = 1, articulada ψ = 10), al menos 1.0: de ${Math.min(...columns.map((item) => item.effectiveLengthFactor)).toFixed(2)} a ${Math.max(...columns.map((item) => item.effectiveLengthFactor)).toFixed(2)}.`
        : `k = ${input.effectiveLengthFactor} en todas las columnas.`,
    });
  }
  if (joints.length) {
    const worst = joints.reduce((best, joint) => (joint.ratio < best.ratio ? joint : best), joints[0]!);
    frameChecks.push({
      id: 'strong-column',
      label: 'Columna fuerte, viga débil (informativa)',
      status: 'info',
      reference: complementary('Relación de resistencias de diseño'),
      note: `Menor ΣMc/ΣMv = ${worst.ratio.toFixed(2)} en el eje ${worst.line + 1}, nivel ${worst.level}. Es orientativa (resistencias de diseño, sin detallado sísmico): la jerarquía de resistencias de la norma sísmica queda fuera del alcance.`,
    });
  }
  const checks = [...memberChecks, ...frameChecks];
  return {
    ok: true,
    input,
    nodes: model.nodes.map((node) => ({ x: node.x, y: node.y })),
    members,
    beams,
    columns,
    stories,
    joints,
    lateral,
    selfWeight: { beamKnPerM: selfWeight.beam, columnKnPerM: selfWeight.column },
    loadCases: set.cases.length,
    combinations,
    checks,
    governingRatio: governingRatio(memberChecks),
    status: overallStatus(checks),
  };
}
