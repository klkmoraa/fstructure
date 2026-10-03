import { buildStations, type BeamAnalysis, type BeamAnalysisOutcome, type BeamEnd, type CaseResponse } from './beamAnalysis';
import { designBeam, type BeamDesignInput, type BeamDesignResult } from './beam';
import { designCode, isDesignCodeId, type DesignCodeId, type LoadCombination } from './codes';
import { designColumn, momentCapacityAt, type ColumnDesignResult, type ColumnGroup } from './column';
import { complementary, governingRatio, isPositiveFinite, overallStatus, type ClauseReference, type ElementCheck } from './shared';

/**
 * Estructura plana de concreto: vigas y columnas diseñadas a partir de un
 * análisis de marco por casos. La estructura llega de una **fuente**: el
 * pórtico que genera el taller (`frame.ts`) o un Modelo 2D traído por el
 * puente declarado de `src/integrations`. La fuente entrega la geometría, la
 * clasificación de cada miembro y una función que resuelve todos los casos;
 * este módulo no sabe de dónde vienen.
 *
 * - **Vigas.** Las vigas colineales y con la misma sección que se tocan forman
 *   una línea continua que se diseña con `designBeam`, alimentado con la
 *   respuesta del marco; la flecha vuelve a analizar la fuente con las
 *   inercias agrietadas de esa línea.
 * - **Columnas.** Cada columna se revisa con `designColumn` en los estados que
 *   maximizan y minimizan su carga axial y maximizan el momento en cada
 *   sentido, con Pu, M1, M2 y V de la misma selección de casos. La altura libre
 *   descuenta medio peralte de las vigas que llegan a cada extremo, k sale del
 *   nomograma de Jackson y Moreland y el índice de estabilidad del entrepiso de
 *   la rigidez lateral del propio marco (caso de sondeo).
 *
 * Convención del caso de sondeo: 1 kN en total en cada elevación donde termina
 * una columna, repartido entre los nudos de esa elevación (`probeLevels`).
 */

export interface StructureSection {
  /** Ancho b: perpendicular al plano. */
  readonly widthMm: number;
  /** Peralte h: en el plano. */
  readonly heightMm: number;
}

export type StructureSupport = 'fixed' | 'pinned' | 'roller' | 'free';

export interface StructureNode {
  readonly x: number;
  readonly y: number;
  readonly support: StructureSupport;
}

export type StructureMemberKind = 'beam' | 'column' | 'other';

export interface StructureMember {
  readonly id: string;
  readonly label: string;
  readonly i: number;
  readonly j: number;
  readonly kind: StructureMemberKind;
  /** Por qué un miembro `other` no se diseña. */
  readonly reason?: string;
  readonly section: StructureSection;
  /** EI usado en el análisis, kN·m² (para ψ). */
  readonly flexuralStiffnessKnM2: number;
  /** Carga uniforme de servicio de referencia para la lámina de la viga, kN/m (sin peso propio). */
  readonly displayDeadKnPerM: number;
  readonly displayLiveKnPerM: number;
  /** Carga puntual de referencia del tramo (la mayor), para la lámina y las estaciones de la viga. */
  readonly displayPoint?: { readonly deadKn: number; readonly liveKn: number; readonly atM: number };
}

export type StructureCaseKind = 'dead' | 'live' | 'lateral' | 'probe';

export interface StructureCase {
  readonly id: string;
  readonly label: string;
  readonly kind: StructureCaseKind;
}

/** Acciones y desplazamientos en ejes locales del miembro (axial a tensión positiva; m). */
export interface StructureAction {
  readonly axial: number;
  readonly shear: number;
  readonly moment: number;
  readonly u: number;
  readonly v: number;
}

export interface StructureCaseResult {
  /** [ux, uy, rz] por nudo, m y rad. */
  readonly nodeDisplacements: readonly (readonly [number, number, number])[];
  /** Acciones del miembro `memberIndex` a `x` m de su nudo i. */
  readonly at: (memberIndex: number, x: number) => StructureAction;
}

export type StructureAnalysisOutcome =
  | { readonly ok: true; readonly cases: readonly StructureCaseResult[] }
  | { readonly ok: false; readonly error: string };

export interface StructureSource {
  readonly kind: 'frame' | 'model2d';
  /** «Pórtico 2 claros × 2 niveles», «Modelo 2D · Pórtico de ejemplo». */
  readonly label: string;
  readonly nodes: readonly StructureNode[];
  readonly members: readonly StructureMember[];
  readonly cases: readonly StructureCase[];
  /** Cada nivel restringido lateralmente por otro sistema: sin δs. */
  readonly braced: boolean;
  /** Resuelve todos los casos; `inertiaOverrides` cambia la inercia (m⁴) de algunos miembros. */
  analyze(inertiaOverrides?: ReadonlyMap<number, number>): StructureAnalysisOutcome;
  /** Fuerzas laterales por elevación para dibujarlas, kN. */
  readonly lateralLevels?: readonly { readonly y: number; readonly kN: number }[];
  /** Supuestos y datos que la fuente no pudo traducir. */
  readonly notes?: readonly string[];
}

/**
 * Estructura que se arma fuera del taller —un Modelo 2D— y llega por la
 * frontera de la app (`src/features/workspace`). El taller sólo conoce este
 * contrato: nunca importa el modelo ni lo lee.
 */
export interface ExternalStructureSource {
  /** Nombre del modelo de origen. */
  readonly label: string;
  /** Cambia cuando cambia el modelo: invalida lo calculado. */
  readonly revision: string;
  readonly summary: {
    readonly members: number;
    readonly beams: number;
    readonly columns: number;
    readonly skipped: number;
    readonly deadCases: number;
    readonly liveCases: number;
    readonly lateralCases: number;
    /** Casos que no entran (inactivos o de categoría «otro»). */
    readonly ignoredCases: readonly string[];
  };
  /** f′c del concreto del modelo, si su material lo declara. */
  readonly fcMpa: number | null;
  /** Los casos permanentes del modelo ya incluyen el peso propio. */
  readonly includesSelfWeight: boolean;
  /** Por qué no se puede diseñar, si no se puede. */
  readonly errors: readonly string[];
  create(options: { readonly braced: boolean }): StructureSource | null;
}

export interface StructureColumnReinforcement {
  readonly barDiameterMm: number;
  /** Barras por cara b (perpendicular al plano), con esquinas. */
  readonly barsAlongWidth: number;
  /** Barras por cara h (en el plano), con esquinas. */
  readonly barsAlongDepth: number;
  readonly tieDiameterMm: number;
}

export interface StructureDesignOptions {
  readonly code: DesignCodeId;
  /** Recubrimiento libre hasta el estribo, el mismo en vigas y columnas. */
  readonly coverMm: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly fyStirrupMpa: number;
  readonly maxAggregateMm: number;
  /** El peso propio va en los casos de la fuente; aquí sólo decide lo que dibuja la lámina. */
  readonly includeSelfWeight: boolean;
  readonly combinations: readonly LoadCombination[];
  readonly lateralCombinations: readonly LoadCombination[];
  readonly lateralReference?: ClauseReference;
  readonly sustainedLiveRatio: number;
  readonly longTermXi: number;
  readonly damagesNonstructural: boolean;
  readonly beamBarDiameterMm: number | null;
  readonly stirrupDiameterMm: number | null;
  readonly columnReinforcement: StructureColumnReinforcement;
  readonly group: ColumnGroup;
  /** k propio de las columnas; `null`: 1.0 arriostrado, nomograma con desplazamiento. */
  readonly effectiveLengthFactor: number | null;
}

/** Miembro con sus envolventes para dibujar la estructura. */
export interface StructureDiagramMember {
  readonly index: number;
  readonly id: string;
  readonly label: string;
  readonly kind: StructureMemberKind;
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
  /** Desplazamientos locales bajo la primera acción lateral sin factores, m (vacíos sin lateral). */
  readonly lateralV: readonly number[];
  readonly lateralU: readonly number[];
  /** Desplazamientos de servicio (toda la CM y la CV, sin factores), m. */
  readonly serviceV: readonly number[];
  readonly serviceU: readonly number[];
  /** Cociente que rige en el miembro; NaN si no se diseña. */
  readonly ratio: number;
  readonly status: 'pass' | 'fail' | 'warning' | 'skip';
  /** Línea de viga o columna a la que pertenece. */
  readonly designId: string | null;
}

export interface StructureColumnState {
  readonly label: string;
  readonly combination: string;
  /** Compresión positiva. */
  readonly axialKn: number;
  /** Momentos en los extremos con la convención de una columna que sube (tensión en la cara +X positiva). */
  readonly topKnm: number;
  readonly bottomKnm: number;
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

export interface StructureColumnDesign {
  readonly id: string;
  readonly memberIndex: number;
  readonly label: string;
  /** Eje (de izquierda a derecha) y entrepiso (de abajo hacia arriba), desde 0. */
  readonly axis: number;
  readonly story: number;
  readonly result: ColumnDesignResult;
  readonly states: readonly StructureColumnState[];
  readonly governingState: number;
  readonly effectiveLengthFactor: number;
  readonly psiTop: number;
  readonly psiBottom: number;
  readonly clearHeightM: number;
}

export interface StructureBeamDesign {
  readonly id: string;
  readonly label: string;
  /** Elevación de la línea (índice en `levels`). */
  readonly level: number;
  readonly memberIndexes: readonly number[];
  readonly result: BeamDesignResult;
  /** Cociente que rige en cada tramo: flexión, cortante y flecha. */
  readonly spanRatios: readonly number[];
}

export interface StructureStoryResult {
  readonly index: number;
  readonly yBottom: number;
  readonly yTop: number;
  readonly heightM: number;
  /** Cortante del entrepiso bajo la acción lateral que más lo deriva, kN. */
  readonly shearKn: number;
  readonly driftMm: number;
  readonly driftRatio: number;
  readonly stiffnessKnPerM: number;
  readonly stabilityIndex: number;
  readonly verticalLoadKn: number;
}

export interface StructureJoint {
  readonly node: number;
  readonly label: string;
  readonly columnsKnm: number;
  readonly beamsKnm: number;
  readonly ratio: number;
}

export interface StructureDesignResult {
  readonly ok: true;
  readonly source: { readonly kind: StructureSource['kind']; readonly label: string; readonly notes: readonly string[] };
  readonly options: StructureDesignOptions;
  readonly braced: boolean;
  readonly nodes: readonly StructureNode[];
  /** Elevaciones con vigas o extremos de columna, de abajo hacia arriba. */
  readonly levels: readonly number[];
  readonly members: readonly StructureDiagramMember[];
  readonly beams: readonly StructureBeamDesign[];
  readonly columns: readonly StructureColumnDesign[];
  readonly stories: readonly StructureStoryResult[];
  readonly joints: readonly StructureJoint[];
  readonly lateral: boolean;
  readonly lateralLevels: readonly { readonly y: number; readonly kN: number }[];
  readonly skipped: readonly { readonly id: string; readonly label: string; readonly reason: string }[];
  readonly loadCases: number;
  readonly combinations: readonly LoadCombination[];
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

export interface StructureDesignError { readonly ok: false; readonly errors: readonly string[] }

/** Estaciones por miembro para los diagramas. */
const MEMBER_STATIONS = 24;
const TOLERANCE = 1e-9;
/** Tolerancia de elevaciones y ejes, m. */
const LEVEL_TOLERANCE = 0.005;
const round = (value: number) => Math.round(value / LEVEL_TOLERANCE) * LEVEL_TOLERANCE;

/** Elevaciones donde termina alguna columna (superior): ahí actúa el caso de sondeo. */
export function probeLevels(nodes: readonly StructureNode[], members: readonly StructureMember[]): number[] {
  const tops = members.filter((member) => member.kind === 'column').map((member) => round(Math.max(nodes[member.i]!.y, nodes[member.j]!.y)));
  return [...new Set(tops)].sort((a, b) => a - b);
}

/** Cargas del caso de sondeo: 1 kN por elevación de `probeLevels`, repartido entre sus nudos. */
export function probeLoads(nodes: readonly StructureNode[], members: readonly StructureMember[]): { node: number; fx: number }[] {
  return probeLevels(nodes, members).flatMap((level) => {
    const at = nodes.flatMap((node, index) => Math.abs(round(node.y) - level) < LEVEL_TOLERANCE / 2 ? [index] : []);
    return at.map((node) => ({ node, fx: 1 / at.length }));
  });
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

const lengthOf = (nodes: readonly StructureNode[], member: StructureMember) =>
  Math.hypot(nodes[member.j]!.x - nodes[member.i]!.x, nodes[member.j]!.y - nodes[member.i]!.y);

interface BeamLine {
  readonly members: readonly { readonly index: number; readonly reversed: boolean }[];
  /** Nudos de la línea en orden, uno más que tramos. */
  readonly nodes: readonly number[];
}

/**
 * Líneas de viga: tramos colineales con la misma sección que comparten nudo.
 * Cada línea se ordena de izquierda a derecha (o de abajo hacia arriba si fuera
 * vertical) y marca los tramos dibujados al revés.
 */
function beamLines(nodes: readonly StructureNode[], members: readonly StructureMember[]): BeamLine[] {
  const beams = members.flatMap((member, index) => member.kind === 'beam' ? [index] : []);
  const direction = (index: number) => {
    const member = members[index]!;
    const length = lengthOf(nodes, member);
    return { x: (nodes[member.j]!.x - nodes[member.i]!.x) / length, y: (nodes[member.j]!.y - nodes[member.i]!.y) / length };
  };
  const sameSection = (a: number, b: number) => Math.abs(members[a]!.section.widthMm - members[b]!.section.widthMm) < 1
    && Math.abs(members[a]!.section.heightMm - members[b]!.section.heightMm) < 1;
  const atNode = new Map<number, number[]>();
  for (const index of beams) for (const node of [members[index]!.i, members[index]!.j]) atNode.set(node, [...(atNode.get(node) ?? []), index]);
  const link = (index: number, node: number) => {
    const others = (atNode.get(node) ?? []).filter((other) => other !== index);
    if (others.length !== 1 || (atNode.get(node) ?? []).length !== 2) return undefined;
    const other = others[0]!;
    const a = direction(index);
    const b = direction(other);
    return Math.abs(a.x * b.x + a.y * b.y) > 0.999 && sameSection(index, other) ? other : undefined;
  };
  const seen = new Set<number>();
  const lines: BeamLine[] = [];
  for (const start of beams) {
    if (seen.has(start)) continue;
    // Primer extremo: avanza desde `start` por su nudo i hasta que no haya enlace.
    const guard = new Set<number>([start]);
    let endMember = start;
    let endNode = members[start]!.i;
    for (;;) {
      const next = link(endMember, endNode);
      if (next === undefined || guard.has(next)) break;
      guard.add(next);
      endNode = members[next]!.i === endNode ? members[next]!.j : members[next]!.i;
      endMember = next;
    }
    // Desde ese extremo, recorre la línea entera.
    const ordered: { index: number; reversed: boolean }[] = [];
    const lineNodes = [endNode];
    let current = endMember;
    let entry = endNode;
    for (;;) {
      const member = members[current]!;
      const reversed = member.j === entry;
      const exit = reversed ? member.i : member.j;
      ordered.push({ index: current, reversed });
      seen.add(current);
      lineNodes.push(exit);
      const next = link(current, exit);
      if (next === undefined || seen.has(next)) break;
      current = next;
      entry = exit;
    }
    // Orden de izquierda a derecha (o de abajo hacia arriba).
    const first = nodes[lineNodes[0]!]!;
    const last = nodes[lineNodes[lineNodes.length - 1]!]!;
    const flip = last.x < first.x - TOLERANCE || (Math.abs(last.x - first.x) <= TOLERANCE && last.y < first.y);
    lines.push(flip
      ? { members: [...ordered].reverse().map((item) => ({ index: item.index, reversed: !item.reversed })), nodes: [...lineNodes].reverse() }
      : { members: ordered, nodes: lineNodes });
  }
  return lines;
}

/** Superpone casos en una combinación eligiendo, caso por caso, el factor que maximiza `direction · total`. */
function superpose(
  values: (caseIndex: number) => number,
  dead: readonly number[],
  live: readonly number[],
  lateral: number | null,
  factors: LoadCombination,
  lateralSign: number,
  direction: 1 | -1,
) {
  let deadTotal = 0;
  let liveTotal = 0;
  const deadPicks: number[] = [];
  const livePicks: number[] = [];
  for (const index of dead) {
    const value = values(index);
    const factor = direction * value >= 0 ? factors.dead : factors.favorableDead;
    deadPicks.push(factor);
    deadTotal += factor * value;
  }
  for (const index of live) {
    const value = values(index);
    const factor = direction * value > 0 ? factors.live : 0;
    livePicks.push(factor);
    liveTotal += factor * value;
  }
  const lateralTotal = lateral !== null && factors.lateral ? lateralSign * factors.lateral * values(lateral) : 0;
  return { total: deadTotal + liveTotal + lateralTotal, dead: deadTotal, live: liveTotal, lateral: lateralTotal, picks: { dead: deadPicks, live: livePicks } };
}

function applyPicks(values: (caseIndex: number) => number, dead: readonly number[], live: readonly number[], lateral: number | null, picks: { dead: number[]; live: number[] }, factors: LoadCombination, lateralSign: number) {
  let deadTotal = 0;
  let liveTotal = 0;
  dead.forEach((index, position) => { deadTotal += picks.dead[position]! * values(index); });
  live.forEach((index, position) => { liveTotal += picks.live[position]! * values(index); });
  const lateralTotal = lateral !== null && factors.lateral ? lateralSign * factors.lateral * values(lateral) : 0;
  return { total: deadTotal + liveTotal + lateralTotal, dead: deadTotal, live: liveTotal, lateral: lateralTotal };
}

/** Variantes de una combinación: sin lateral, o cada acción lateral en cada sentido. */
const variantsOf = (combination: LoadCombination, laterals: readonly number[]) =>
  combination.lateral && laterals.length
    ? laterals.flatMap((lateral) => [{ lateral, sign: 1 }, { lateral, sign: -1 }])
    : [{ lateral: null as number | null, sign: 0 }];

function validateOptions(options: StructureDesignOptions): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(options.code)) return ['Norma de diseño desconocida.'];
  const positive: [number, string][] = [
    [options.coverMm, 'Recubrimiento'], [options.fcMpa, "f'c"], [options.fyMpa, 'fy'], [options.fyStirrupMpa, 'fy de estribos'], [options.maxAggregateMm, 'Agregado máximo'],
  ];
  for (const [value, label] of positive) if (!isPositiveFinite(value)) errors.push(`${label} debe ser mayor que cero.`);
  if (options.effectiveLengthFactor !== null && !isPositiveFinite(options.effectiveLengthFactor)) errors.push('El factor k propio debe ser mayor que cero.');
  if (options.combinations.length < 1) errors.push('Se requiere al menos una combinación de carga.');
  return errors;
}

export function designStructure(source: StructureSource, options: StructureDesignOptions): StructureDesignResult | StructureDesignError {
  const optionErrors = validateOptions(options);
  if (optionErrors.length) return { ok: false, errors: optionErrors };
  const { nodes, members } = source;
  const beamsIndexes = members.flatMap((member, index) => member.kind === 'beam' ? [index] : []);
  const columnIndexes = members.flatMap((member, index) => member.kind === 'column' ? [index] : []);
  if (!beamsIndexes.length && !columnIndexes.length) return { ok: false, errors: ['La estructura no tiene vigas ni columnas de concreto que diseñar.'] };
  const sectionErrors = members.flatMap((member) => member.kind !== 'other' && !(isPositiveFinite(member.section.widthMm) && isPositiveFinite(member.section.heightMm))
    ? [`${member.label}: la sección debe tener base y peralte mayores que cero.`] : []);
  if (sectionErrors.length) return { ok: false, errors: sectionErrors };

  const outcome = source.analyze();
  if (!outcome.ok) return { ok: false, errors: [outcome.error] };
  const analysis = outcome.cases;
  const dead = source.cases.flatMap((item, index) => item.kind === 'dead' ? [index] : []);
  const live = source.cases.flatMap((item, index) => item.kind === 'live' ? [index] : []);
  const laterals = source.braced ? [] : source.cases.flatMap((item, index) => item.kind === 'lateral' ? [index] : []);
  const probe = source.braced ? -1 : source.cases.findIndex((item) => item.kind === 'probe');
  const lateral = laterals.length > 0;
  const combinations = lateral ? [...options.combinations, ...options.lateralCombinations] : options.combinations;
  const code = designCode(options.code);
  const lengths = members.map((member) => lengthOf(nodes, member));
  const at = (caseIndex: number, memberIndex: number, x: number) => analysis[caseIndex]!.at(memberIndex, x);

  // Elevaciones y entrepisos.
  const levels = [...new Set([
    ...beamsIndexes.flatMap((index) => [round(nodes[members[index]!.i]!.y), round(nodes[members[index]!.j]!.y)]),
    ...columnIndexes.flatMap((index) => [round(nodes[members[index]!.i]!.y), round(nodes[members[index]!.j]!.y)]),
  ])].sort((a, b) => a - b);
  const levelOf = (y: number) => levels.findIndex((level) => Math.abs(level - round(y)) < LEVEL_TOLERANCE / 2);
  const axes = [...new Set(columnIndexes.map((index) => round((nodes[members[index]!.i]!.x + nodes[members[index]!.j]!.x) / 2)))].sort((a, b) => a - b);
  const columnEnds = (index: number) => {
    const member = members[index]!;
    const upward = nodes[member.j]!.y >= nodes[member.i]!.y;
    return { bottom: upward ? member.i : member.j, top: upward ? member.j : member.i, upward };
  };
  const storyKey = (index: number) => {
    const { bottom, top } = columnEnds(index);
    return `${round(nodes[bottom]!.y)}|${round(nodes[top]!.y)}`;
  };
  const storyKeys = [...new Set(columnIndexes.map(storyKey))].sort((a, b) => {
    const [ab, at2] = a.split('|').map(Number);
    const [bb, bt] = b.split('|').map(Number);
    return at2! - bt! || ab! - bb!;
  });
  const probeTops = probeLevels(nodes, members);
  const nodeUx = (caseIndex: number, node: number) => analysis[caseIndex]!.nodeDisplacements[node]![0];
  const storyColumns = (key: string) => columnIndexes.filter((index) => storyKey(index) === key);
  const verticalLoad = (key: string, combination: LoadCombination) => storyColumns(key).reduce((total, index) => {
    const compression = (caseIndex: number) => -at(caseIndex, index, columnEnds(index).upward ? 0 : lengths[index]!).axial;
    return total + dead.reduce((sum, caseIndex) => sum + combination.dead * compression(caseIndex), 0)
      + live.reduce((sum, caseIndex) => sum + combination.live * compression(caseIndex), 0);
  }, 0);
  const stories: StructureStoryResult[] = storyKeys.map((key, storyIndex) => {
    const [yBottom, yTop] = key.split('|').map(Number) as [number, number];
    const heightM = yTop - yBottom;
    const group = storyColumns(key);
    const drift = (caseIndex: number) => group.reduce((total, index) => {
      const { bottom, top } = columnEnds(index);
      return total + nodeUx(caseIndex, top) - nodeUx(caseIndex, bottom);
    }, 0) / group.length;
    const probeShear = probeTops.filter((level) => level >= yTop - LEVEL_TOLERANCE / 2).length;
    const probeDrift = probe >= 0 ? drift(probe) : 0;
    const stiffness = probe >= 0 && Math.abs(probeDrift) > TOLERANCE ? probeShear / Math.abs(probeDrift) : Number.POSITIVE_INFINITY;
    const lateralDrifts = laterals.map((caseIndex) => ({ caseIndex, drift: drift(caseIndex) }));
    const worstLateral = lateralDrifts.reduce<{ caseIndex: number; drift: number } | null>((best, item) => !best || Math.abs(item.drift) > Math.abs(best.drift) ? item : best, null);
    const worst = combinations.reduce<{ vertical: number; q: number }>((best, combination) => {
      const vertical = verticalLoad(key, combination);
      const q = source.braced || !Number.isFinite(stiffness) ? 0 : vertical / (stiffness * heightM);
      return q > best.q ? { vertical, q } : best;
    }, { vertical: verticalLoad(key, combinations[0]!), q: 0 });
    return {
      index: storyIndex,
      yBottom,
      yTop,
      heightM,
      shearKn: worstLateral && Number.isFinite(stiffness) ? Math.abs(worstLateral.drift) * stiffness : 0,
      driftMm: worstLateral ? Math.abs(worstLateral.drift) * 1e3 : 0,
      driftRatio: worstLateral ? Math.abs(worstLateral.drift) / heightM : 0,
      stiffnessKnPerM: stiffness,
      stabilityIndex: worst.q,
      verticalLoadKn: worst.vertical,
    };
  });
  const stabilityFor = (columnIndex: number, combination: LoadCombination) => {
    if (source.braced) return 0;
    const story = stories[storyKeys.indexOf(storyKey(columnIndex))]!;
    return Number.isFinite(story.stiffnessKnPerM) ? verticalLoad(storyKey(columnIndex), combination) / (story.stiffnessKnPerM * story.heightM) : 0;
  };

  // Vigas: cada línea continua con el motor de la viga y la respuesta de la estructura.
  const lines = beamLines(nodes, members);
  const membersAt = (node: number, kind: StructureMemberKind) => members.flatMap((member, index) => member.kind === kind && (member.i === node || member.j === node) ? [index] : []);
  const beams: StructureBeamDesign[] = [];
  const lineLevelCount = new Map<number, number>();
  for (const line of lines) {
    const spans = line.members.map(({ index, reversed }) => {
      const member = members[index]!;
      const point = member.displayPoint;
      const atM = point ? (reversed ? lengths[index]! - point.atM : point.atM) : lengths[index]! / 2;
      return {
        lengthM: lengths[index]!, deadKnPerM: member.displayDeadKnPerM, liveKnPerM: member.displayLiveKnPerM,
        pointDeadKn: point?.deadKn ?? 0, pointLiveKn: point?.liveKn ?? 0, pointAtM: Math.min(lengths[index]!, Math.max(0, atM)),
      };
    });
    const stations = buildStations({ spans });
    const sample = (cases: readonly StructureCaseResult[], caseIndex: number): CaseResponse => {
      const moment: number[] = [];
      const shear: number[] = [];
      const deflection: number[] = [];
      for (const station of stations) {
        const { index, reversed } = line.members[station.span]!;
        const action = cases[caseIndex]!.at(index, reversed ? lengths[index]! - station.local : station.local);
        // Un tramo dibujado al revés tiene el eje y local hacia abajo: momento y flecha cambian de signo.
        moment.push(reversed ? -action.moment : action.moment);
        shear.push(action.shear);
        deflection.push(reversed ? -action.v : action.v);
      }
      return { moment, shear, deflection };
    };
    const beamAnalysisOf = (cases: readonly StructureCaseResult[]): BeamAnalysis => {
      const starts = [0];
      spans.forEach((span) => starts.push(starts[starts.length - 1]! + span.lengthM));
      return {
        stations: stations.map((station) => station.x),
        stationSpan: stations.map((station) => station.span),
        nodesAtM: starts,
        totalLengthM: starts[starts.length - 1]!,
        deadPerSpan: dead.map((caseIndex) => sample(cases, caseIndex)),
        livePerSpan: live.map((caseIndex) => sample(cases, caseIndex)),
        ...(laterals.length ? { laterals: laterals.map((caseIndex) => sample(cases, caseIndex)) } : {}),
        solverRuns: source.cases.length,
      };
    };
    const endOf = (node: number): BeamEnd => {
      if (membersAt(node, 'column').length || nodes[node]!.support === 'fixed') return 'fixed';
      return nodes[node]!.support === 'free' ? 'free' : 'pin';
    };
    const supportWidth = (node: number) => Math.max(0, ...membersAt(node, 'column').map((index) => members[index]!.section.heightMm));
    const first = members[line.members[0]!.index]!;
    const beamInput: BeamDesignInput = {
      code: options.code,
      widthMm: first.section.widthMm,
      heightMm: first.section.heightMm,
      coverMm: options.coverMm,
      fcMpa: options.fcMpa,
      fyMpa: options.fyMpa,
      fyStirrupMpa: options.fyStirrupMpa,
      spans,
      leftEnd: endOf(line.nodes[0]!),
      rightEnd: endOf(line.nodes[line.nodes.length - 1]!),
      includeSelfWeight: options.includeSelfWeight,
      combinations,
      sustainedLiveRatio: options.sustainedLiveRatio,
      longTermXi: options.longTermXi,
      barDiameterMm: options.beamBarDiameterMm,
      stirrupDiameterMm: options.stirrupDiameterMm,
      maxAggregateMm: options.maxAggregateMm,
      damagesNonstructural: options.damagesNonstructural,
      supportWidthMm: Math.max(supportWidth(line.nodes[0]!), supportWidth(line.nodes[line.nodes.length - 1]!)) || 300,
      flange: null,
      provided: null,
    };
    const level = levelOf((nodes[line.nodes[0]!]!.y + nodes[line.nodes[line.nodes.length - 1]!]!.y) / 2);
    const count = (lineLevelCount.get(level) ?? 0) + 1;
    lineLevelCount.set(level, count);
    const horizontal = Math.abs(nodes[line.nodes[0]!]!.y - nodes[line.nodes[line.nodes.length - 1]!]!.y) < LEVEL_TOLERANCE;
    const label = horizontal && columnIndexes.length
      ? `Viga del nivel ${level}${count > 1 ? ` (${String.fromCharCode(64 + count)})` : ''}`
      : `Viga ${line.members.map(({ index }) => members[index]!.label).join('–')}`;
    const id = `beam-${line.members.map(({ index }) => members[index]!.id).join('+')}`;
    const provider = (inertias?: readonly number[]): BeamAnalysisOutcome => {
      if (!inertias) return { ok: true, analysis: beamAnalysisOf(analysis) };
      const overrides = new Map(line.members.map(({ index }, position) => [index, inertias[position]!]));
      const cracked = source.analyze(overrides);
      return cracked.ok ? { ok: true, analysis: beamAnalysisOf(cracked.cases) } : { ok: false, error: cracked.error };
    };
    const result = designBeam(beamInput, { analyze: provider, demandSource: `${source.kind === 'model2d' ? 'Modelo 2D' : 'Pórtico'} · ${label.toLowerCase()}` });
    if (!result.ok) return { ok: false, errors: result.errors.map((error) => `${label}: ${error}`) };
    const spanRatios = line.members.map((_, span) => {
      const { startM, lengthM } = result.spans[span]!;
      let worst = 0;
      result.diagram.xM.forEach((x, index) => {
        if (x < startM - TOLERANCE || x > startM + lengthM + TOLERANCE) return;
        const positive = Math.max(0, result.diagram.momentMaxKnm[index]!) / Math.max(result.diagram.capacityPositiveKnm[index]!, TOLERANCE);
        const negative = Math.max(0, -result.diagram.momentMinKnm[index]!) / Math.max(-result.diagram.capacityNegativeKnm[index]!, TOLERANCE);
        const shear = Math.max(Math.abs(result.diagram.shearMaxKn[index]!), Math.abs(result.diagram.shearMinKn[index]!)) / Math.max(result.diagram.shearCapacityKn[index]!, TOLERANCE);
        worst = Math.max(worst, positive, negative, shear);
      });
      const span2 = result.spans[span]!;
      return Math.max(worst, span2.checkedDeflectionMm / span2.deflectionLimitMm);
    });
    beams.push({ id, label, level, memberIndexes: line.members.map(({ index }) => index), result, spanRatios });
  }
  beams.sort((a, b) => a.level - b.level || members[a.memberIndexes[0]!]!.label.localeCompare(members[b.memberIndexes[0]!]!.label));

  // Columnas.
  const psiAt = (node: number) => {
    const support = nodes[node]!.support;
    if (support === 'fixed') return 1;
    if (support === 'pinned' || support === 'roller') return 10;
    const stiffness = (kind: StructureMemberKind) => membersAt(node, kind).reduce((total, index) => total + members[index]!.flexuralStiffnessKnM2 / lengths[index]!, 0);
    const beamsAtNode = stiffness('beam');
    return beamsAtNode > 0 ? stiffness('column') / beamsAtNode : 10;
  };
  const beamDepthAt = (node: number) => Math.max(0, ...membersAt(node, 'beam').map((index) => members[index]!.section.heightMm));
  const columns: StructureColumnDesign[] = [];
  for (const index of columnIndexes) {
    const member = members[index]!;
    const { bottom, top, upward } = columnEnds(index);
    const length = lengths[index]!;
    // Convención de columna que sube: un miembro dibujado hacia abajo cambia el signo de su momento.
    const xBottom = upward ? 0 : length;
    const xTop = upward ? length : 0;
    const axial = (caseIndex: number) => -at(caseIndex, index, xBottom).axial;
    const topMoment = (caseIndex: number) => (upward ? 1 : -1) * at(caseIndex, index, xTop).moment;
    const bottomMoment = (caseIndex: number) => (upward ? 1 : -1) * at(caseIndex, index, xBottom).moment;
    const shear = (caseIndex: number) => at(caseIndex, index, xBottom).shear;
    const psiTop = psiAt(top);
    const psiBottom = psiAt(bottom);
    const k = options.effectiveLengthFactor ?? (source.braced ? 1 : swayEffectiveLengthFactor(psiTop, psiBottom));
    const clearHeightM = Math.max(0.1, length - (beamDepthAt(top) + beamDepthAt(bottom)) / 2e3);
    const axis = axes.findIndex((value) => Math.abs(value - round((nodes[member.i]!.x + nodes[member.j]!.x) / 2)) < LEVEL_TOLERANCE / 2);
    const story = storyKeys.indexOf(storyKey(index));
    const label = `Columna del eje ${axis + 1}, nivel ${Math.max(1, levelOf(nodes[top]!.y))}`;
    type Draft = Omit<StructureColumnState, 'ratio' | 'status' | 'designMomentKnm'> & { result: ColumnDesignResult };
    const states: Draft[] = [];
    const seen = new Set<string>();
    for (const combination of combinations) {
      const q = stabilityFor(index, combination);
      for (const variant of variantsOf(combination, laterals)) {
        const candidates: { label: string; values: (caseIndex: number) => number; direction: 1 | -1 }[] = [
          { label: 'Pu máx.', values: axial, direction: 1 },
          { label: 'Pu mín.', values: axial, direction: -1 },
        ];
        for (const direction of [1, -1] as const) {
          const atTop = superpose(topMoment, dead, live, variant.lateral, combination, variant.sign, direction).total * direction;
          const atBottom = superpose(bottomMoment, dead, live, variant.lateral, combination, variant.sign, direction).total * direction;
          candidates.push({ label: direction > 0 ? 'M máx. (+)' : 'M máx. (−)', values: atTop >= atBottom ? topMoment : bottomMoment, direction });
        }
        const combinationLabel = variant.lateral === null ? combination.label
          : `${combination.label.replace(/\s*±\s*/, variant.sign > 0 ? ' + ' : ' − ')}${laterals.length > 1 ? ` · ${source.cases[variant.lateral]!.label}` : ''}${variant.sign > 0 ? ' (→)' : ' (←)'}`;
        for (const candidate of candidates) {
          const chosen = superpose(candidate.values, dead, live, variant.lateral, combination, variant.sign, candidate.direction);
          const pick = (values: (caseIndex: number) => number) => applyPicks(values, dead, live, variant.lateral, chosen.picks, combination, variant.sign);
          const p = pick(axial);
          const mt = pick(topMoment);
          const mb = pick(bottomMoment);
          const v = pick(shear);
          const key = [p.total, mt.total, mb.total].map((value) => value.toFixed(3)).join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          const topGoverns = Math.abs(mt.total) >= Math.abs(mb.total);
          const m2 = topGoverns ? mt : mb;
          const m1 = topGoverns ? mb : mt;
          const ratio = Math.abs(m2.total) > TOLERANCE ? Math.min(1, Math.abs(m1.total) / Math.abs(m2.total)) : 1;
          const nonSway = m2.dead + m2.live;
          const sustained = p.total > TOLERANCE ? Math.min(1, Math.max(0, (p.dead + options.sustainedLiveRatio * p.live) / p.total)) : 0;
          const result = designColumn({
            code: options.code,
            widthMm: member.section.widthMm,
            depthMm: member.section.heightMm,
            coverMm: options.coverMm,
            fcMpa: options.fcMpa,
            fyMpa: options.fyMpa,
            barDiameterMm: options.columnReinforcement.barDiameterMm,
            barsAlongWidth: options.columnReinforcement.barsAlongWidth,
            barsAlongDepth: options.columnReinforcement.barsAlongDepth,
            tieDiameterMm: options.columnReinforcement.tieDiameterMm,
            maxAggregateMm: options.maxAggregateMm,
            axialKn: p.total,
            momentXKnm: source.braced ? Math.abs(m2.total) : Math.abs(nonSway),
            momentYKnm: 0,
            shearXKn: 0,
            shearYKn: Math.abs(v.total),
            unbracedLengthM: clearHeightM,
            effectiveLengthFactor: source.braced ? k : Math.max(1, k),
            curvature: mt.total * mb.total > 0 ? 'single' : 'double',
            endMomentRatio: ratio,
            sustainedRatio: sustained,
            braced: source.braced,
            swayMomentXKnm: source.braced ? 0 : Math.abs(m2.lateral),
            swayMomentYKnm: 0,
            stabilityIndex: q,
            group: options.group,
            groundFloor: story === 0 && lateral,
          }, { demandSource: `${source.kind === 'model2d' ? 'Modelo 2D' : 'Pórtico'} · ${combinationLabel} · ${candidate.label}` });
          if (!result.ok) return { ok: false, errors: result.errors.map((error) => `${label}: ${error}`) };
          states.push({
            label: candidate.label, combination: combinationLabel, axialKn: p.total, topKnm: mt.total, bottomKnm: mb.total,
            swayKnm: m2.lateral, nonSwayKnm: nonSway, shearKn: v.total, sustainedRatio: sustained, stabilityIndex: q, result,
          });
        }
      }
    }
    const severity = (status: 'pass' | 'fail' | 'warning') => (status === 'fail' ? 2 : status === 'warning' ? 1 : 0);
    const governingState = states.reduce((best, state, position) => {
      const current = states[best]!;
      return severity(state.result.status) > severity(current.result.status)
        || (severity(state.result.status) === severity(current.result.status) && state.result.governingRatio > current.result.governingRatio) ? position : best;
    }, 0);
    columns.push({
      id: `column-${member.id}`,
      memberIndex: index,
      label,
      axis,
      story,
      result: states[governingState]!.result,
      states: states.map(({ result, ...state }) => ({ ...state, designMomentKnm: result.magnification.x.designMomentKnm, ratio: result.governingRatio, status: result.status })),
      governingState,
      effectiveLengthFactor: source.braced ? k : Math.max(1, k),
      psiTop,
      psiBottom,
      clearHeightM,
    });
  }
  columns.sort((a, b) => a.story - b.story || a.axis - b.axis);

  // Nudos con columna arriba y abajo: relación de resistencias de diseño (informativa).
  const joints: StructureJoint[] = [];
  nodes.forEach((node, nodeIndex) => {
    const below = columns.filter((column) => columnEnds(column.memberIndex).top === nodeIndex);
    const above = columns.filter((column) => columnEnds(column.memberIndex).bottom === nodeIndex);
    if (!below.length || !above.length) return;
    let beamsKnm = 0;
    let sides = 0;
    for (const beam of beams) {
      const lineNodes = lines.find((line) => line.members.map((item) => item.index).join() === beam.memberIndexes.join())?.nodes ?? [];
      const nodePosition = lineNodes.indexOf(nodeIndex);
      if (nodePosition < 0) continue;
      const station = beam.result.nodesAtM[nodePosition]!;
      const indexAt = beam.result.diagram.xM.findIndex((value) => Math.abs(value - station) < 1e-6);
      if (indexAt < 0) continue;
      const positive = beam.result.diagram.capacityPositiveKnm[indexAt]!;
      const negative = -beam.result.diagram.capacityNegativeKnm[indexAt]!;
      const interior = nodePosition > 0 && nodePosition < lineNodes.length - 1;
      beamsKnm += interior ? positive + negative : Math.max(positive, negative);
      sides += interior ? 2 : 1;
    }
    if (!sides) return;
    const strength = (column: StructureColumnDesign) => momentCapacityAt(column.result.aboutX.design, column.states[column.governingState]!.axialKn);
    const columnsKnm = [...below, ...above].reduce((total, column) => total + strength(column), 0);
    const axis = axes.findIndex((value) => Math.abs(value - round(node.x)) < LEVEL_TOLERANCE / 2);
    joints.push({ node: nodeIndex, label: `Eje ${axis + 1}, nivel ${levelOf(node.y)}`, columnsKnm, beamsKnm, ratio: columnsKnm / beamsKnm });
  });

  // Envolventes de cada miembro para dibujar.
  const firstLateral = laterals[0] ?? null;
  const diagramMembers: StructureDiagramMember[] = members.map((member, index) => {
    const length = lengths[index]!;
    const stations = Array.from({ length: MEMBER_STATIONS + 1 }, (_, step) => length * step / MEMBER_STATIONS);
    const sampled = analysis.map((caseResult) => stations.map((x) => caseResult.at(index, x)));
    const envelope = (pick: (action: StructureAction) => number) => {
      const max: number[] = [];
      const min: number[] = [];
      stations.forEach((_, s) => {
        const values = (caseIndex: number) => pick(sampled[caseIndex]![s]!);
        let high = Number.NEGATIVE_INFINITY;
        let low = Number.POSITIVE_INFINITY;
        for (const combination of combinations) {
          for (const variant of variantsOf(combination, laterals)) {
            high = Math.max(high, superpose(values, dead, live, variant.lateral, combination, variant.sign, 1).total);
            low = Math.min(low, superpose(values, dead, live, variant.lateral, combination, variant.sign, -1).total);
          }
        }
        max.push(high);
        min.push(low);
      });
      return { max, min };
    };
    const moment = envelope((action) => action.moment);
    const shearEnvelope = envelope((action) => action.shear);
    const axialEnvelope = envelope((action) => action.axial);
    const serviceSum = (pick: (action: StructureAction) => number) => stations.map((_, s) => [...dead, ...live].reduce((total, caseIndex) => total + pick(sampled[caseIndex]![s]!), 0));
    const beam = beams.find((item) => item.memberIndexes.includes(index));
    const column = columns.find((item) => item.memberIndex === index);
    const ratio = beam ? beam.spanRatios[beam.memberIndexes.indexOf(index)]! : column ? column.states.reduce((worst, state) => Math.max(worst, state.ratio), 0) : Number.NaN;
    return {
      index,
      id: member.id,
      label: member.label,
      kind: member.kind,
      start: { x: nodes[member.i]!.x, y: nodes[member.i]!.y },
      end: { x: nodes[member.j]!.x, y: nodes[member.j]!.y },
      stations,
      momentMaxKnm: moment.max,
      momentMinKnm: moment.min,
      shearMaxKn: shearEnvelope.max,
      shearMinKn: shearEnvelope.min,
      axialMaxKn: axialEnvelope.max,
      axialMinKn: axialEnvelope.min,
      lateralV: firstLateral !== null ? sampled[firstLateral]!.map((action) => action.v) : [],
      lateralU: firstLateral !== null ? sampled[firstLateral]!.map((action) => action.u) : [],
      serviceV: serviceSum((action) => action.v),
      serviceU: serviceSum((action) => action.u),
      ratio,
      status: column ? column.result.status : beam ? (ratio > 1 + 1e-9 ? 'fail' : 'pass') : 'skip',
      designId: beam?.id ?? column?.id ?? null,
    };
  });

  // Comprobaciones: una por línea de viga y por columna, y las del conjunto.
  const governingCheck = (checks: readonly ElementCheck[]) => {
    const failing = checks.filter((check) => check.status === 'fail');
    const pool = failing.length ? failing : checks.filter((check) => check.ratio !== undefined && Number.isFinite(check.ratio));
    return pool.reduce<ElementCheck | undefined>((best, check) => (!best || (check.ratio ?? 0) > (best.ratio ?? 0) ? check : best), undefined) ?? checks[0]!;
  };
  const sourceName = source.kind === 'model2d' ? 'Modelo 2D' : 'Pórtico';
  const memberChecks: ElementCheck[] = [
    ...beams.map((beam): ElementCheck => {
      const rule = governingCheck(beam.result.checks);
      return {
        id: beam.id,
        label: beam.label,
        status: beam.result.status,
        ratio: beam.result.governingRatio,
        demand: beam.result.governingRatio,
        capacity: 1,
        unit: '',
        reference: rule.reference,
        note: `Rige: ${rule.label.toLowerCase()}${rule.note ? ` — ${rule.note}` : ''}`,
        location: `${beam.label}${rule.location ? ` · ${rule.location}` : ''}`,
        combination: rule.combination ?? `${sourceName} · envolvente`,
      };
    }),
    ...columns.map((column): ElementCheck => {
      const rule = governingCheck(column.result.checks);
      const state = column.states[column.governingState]!;
      return {
        id: column.id,
        label: column.label,
        status: column.result.status,
        ratio: column.result.governingRatio,
        demand: column.result.governingRatio,
        capacity: 1,
        unit: '',
        reference: rule.reference,
        note: `Rige: ${rule.label.toLowerCase()} con Pu = ${state.axialKn.toFixed(0)} kN, M = ${Math.max(Math.abs(state.topKnm), Math.abs(state.bottomKnm)).toFixed(1)} kN·m · k = ${column.effectiveLengthFactor.toFixed(2)}${rule.note ? ` — ${rule.note}` : ''}`,
        location: column.label,
        combination: `${sourceName} · ${state.combination} · ${state.label}`,
      };
    }),
  ];
  const refs = code.refs;
  const frameChecks: ElementCheck[] = [{
    id: 'load-factors',
    label: 'Combinaciones de carga',
    status: 'info',
    reference: refs.loadFactors,
    note: `${options.combinations.map((item) => item.label).join(' · ')}; viva alternada ${source.kind === 'model2d' ? 'por barra cargada' : 'por claro y nivel'} (nula donde favorece)${code.usesStructureGroup ? `; ${options.combinations[0]!.favorableDead} en la muerta donde favorece` : ''}.`,
  }];
  if (lateral) {
    frameChecks.push({
      id: 'lateral-combinations',
      label: 'Combinaciones con acción lateral',
      status: 'info',
      reference: options.lateralReference ?? complementary('Factores capturados'),
      note: `${options.lateralCombinations.map((item) => item.label).join(' · ')}, en ambos sentidos${laterals.length > 1 ? ` y con cada acción lateral por separado (${laterals.map((caseIndex) => source.cases[caseIndex]!.label).join(', ')})` : ''}. ${code.lateralCombinations('B').note}`,
    });
    const worstDrift = stories.reduce((best, story) => (story.driftRatio > best.driftRatio ? story : best), stories[0]!);
    if (worstDrift) {
      frameChecks.push({
        id: 'drift',
        label: 'Deriva de entrepiso',
        status: 'info',
        reference: complementary('Análisis elástico con las fuerzas capturadas'),
        note: `Máxima en el entrepiso ${worstDrift.index + 1}: Δ/h = ${worstDrift.driftRatio.toFixed(4)} (${worstDrift.driftMm.toFixed(1)} mm). Es elástica con las fuerzas capturadas: amplifícala según la norma de sismo antes de compararla con su límite.`,
      });
    }
  }
  if (!source.braced && stories.length) {
    const worst = stories.reduce((best, story) => (story.stabilityIndex > best.stabilityIndex ? story : best), stories[0]!);
    frameChecks.push({
      id: 'stability-index',
      label: code.id === 'ntc-2023' ? 'Índice de estabilidad λest' : 'Índice de estabilidad Q',
      status: 'info',
      reference: refs.sway,
      note: `Mayor en el entrepiso ${worst.index + 1}: ${worst.stabilityIndex.toFixed(3)} = ΣPu·Δ/(V·h) con ΣPu = ${worst.verticalLoadKn.toFixed(0)} kN y la rigidez lateral del análisis (${Number.isFinite(worst.stiffnessKnPerM) ? worst.stiffnessKnPerM.toFixed(0) : '∞'} kN/m); δs se aplica a los momentos por desplazamiento.`,
    });
  }
  if (!source.braced && columns.length) {
    frameChecks.push({
      id: 'effective-length',
      label: 'Longitud efectiva k',
      status: 'info',
      reference: options.effectiveLengthFactor === null ? complementary('Nomograma de Jackson y Moreland') : complementary('Factor capturado'),
      note: options.effectiveLengthFactor === null
        ? `k del nomograma con ψ = Σ(EI/L) columnas / Σ(EI/L) vigas (base empotrada ψ = 1, articulada ψ = 10), al menos 1.0: de ${Math.min(...columns.map((item) => item.effectiveLengthFactor)).toFixed(2)} a ${Math.max(...columns.map((item) => item.effectiveLengthFactor)).toFixed(2)}.`
        : `k = ${options.effectiveLengthFactor} en todas las columnas.`,
    });
  }
  if (joints.length) {
    const worst = joints.reduce((best, joint) => (joint.ratio < best.ratio ? joint : best), joints[0]!);
    frameChecks.push({
      id: 'strong-column',
      label: 'Columna fuerte, viga débil (informativa)',
      status: 'info',
      reference: complementary('Relación de resistencias de diseño'),
      note: `Menor ΣMc/ΣMv = ${worst.ratio.toFixed(2)} en ${worst.label.toLowerCase()}. Es orientativa (resistencias de diseño, sin detallado sísmico): la jerarquía de resistencias de la norma sísmica queda fuera del alcance.`,
    });
  }
  const skipped = members.flatMap((member) => member.kind === 'other' ? [{ id: member.id, label: member.label, reason: member.reason ?? 'No se diseña en concreto.' }] : []);
  if (skipped.length) {
    frameChecks.push({
      id: 'skipped-members',
      label: 'Miembros sin diseñar',
      status: 'info',
      reference: complementary('Clasificación de la fuente'),
      note: skipped.map((item) => `${item.label}: ${item.reason}`).join(' · '),
    });
  }
  for (const [position, note] of (source.notes ?? []).entries()) {
    frameChecks.push({ id: `source-note-${position}`, label: 'Nota de la fuente', status: 'info', reference: complementary(sourceName), note });
  }
  const checks = [...memberChecks, ...frameChecks];
  return {
    ok: true,
    source: { kind: source.kind, label: source.label, notes: source.notes ?? [] },
    options,
    braced: source.braced,
    nodes,
    levels,
    members: diagramMembers,
    beams,
    columns,
    stories,
    joints,
    lateral,
    lateralLevels: source.lateralLevels ?? [],
    skipped,
    loadCases: source.cases.length,
    combinations,
    checks,
    governingRatio: governingRatio(memberChecks),
    status: overallStatus(checks),
  };
}
