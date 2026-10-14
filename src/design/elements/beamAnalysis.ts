import { createDefaultProject } from '../../data/defaultProject';
import { evaluateDeformationAt, evaluateDiagramAt } from '../../engine/diagram';
import { analyzeProject } from '../../engine/solver';
import type { AnalysisResult, MemberLoad, NodeModel, ProjectModel, SupportDefinition } from '../../types';

export type BeamEnd = 'pin' | 'roller' | 'fixed' | 'free';

export interface BeamSpanLoads {
  readonly lengthM: number;
  /** Servicio, kN/m, sin peso propio. */
  readonly deadKnPerM: number;
  readonly liveKnPerM: number;
  /** Servicio, kN. */
  readonly pointDeadKn: number;
  readonly pointLiveKn: number;
  /** Posición de la carga puntual medida desde el inicio del claro, m. */
  readonly pointAtM: number;
}

export interface BeamExtraLoad {
  readonly spanIndex: number;
  readonly category: 'dead' | 'live';
  readonly kind: 'point' | 'distributed';
  readonly startM: number;
  readonly endM: number;
  readonly startKn: number;
  readonly endKn: number;
}

interface BeamAnalysisCombination {
  readonly dead: number;
  readonly favorableDead: number;
  readonly live: number;
}

interface BeamAnalysisInput {
  readonly spans: readonly BeamSpanLoads[];
  readonly extraLoads?: readonly BeamExtraLoad[];
  readonly combinations?: readonly BeamAnalysisCombination[];
  readonly leftEnd: BeamEnd;
  readonly rightEnd: BeamEnd;
  /** Peso propio uniforme que se suma a la carga muerta de cada claro. */
  readonly selfWeightKnPerM: number;
  /** Rigidez: E en kN/m², A en m², I en m⁴. */
  readonly elasticModulusKpa: number;
  readonly areaM2: number;
  readonly inertiaM4: number;
  /** Inercia por claro (p. ej. agrietada); si falta se usa `inertiaM4` en todos. */
  readonly inertiaM4PerSpan?: readonly number[];
}

/** Una respuesta de caso: valores por estación a lo largo de toda la viga. */
export interface CaseResponse {
  readonly moment: readonly number[];
  readonly shear: readonly number[];
  /** Flecha vertical, m (positiva hacia arriba). */
  readonly deflection: readonly number[];
}

export interface BeamAnalysis {
  readonly stations: readonly number[];
  /** Claro al que pertenece cada estación. */
  readonly stationSpan: readonly number[];
  readonly nodesAtM: readonly number[];
  readonly totalLengthM: number;
  /** Carga muerta (incluido el peso propio) de un solo claro, para aplicar 0.9 donde favorece. */
  readonly deadPerSpan: readonly CaseResponse[];
  /** Una respuesta por claro con la carga viva sólo en ese claro. */
  readonly livePerSpan: readonly CaseResponse[];
  /**
   * Acciones laterales (sismo o viento) de una estructura, sin factores. Cada
   * una es una alternativa: entra sola, en ambos sentidos, con el factor
   * `lateral` de cada combinación.
   */
  readonly laterals?: readonly CaseResponse[];
  readonly solverRuns: number;
}

export type BeamAnalysisOutcome = { readonly ok: true; readonly analysis: BeamAnalysis } | { readonly ok: false; readonly error: string };

const STATIONS_PER_SPAN = 96;

const supportFor = (end: BeamEnd, restrainsX: boolean): SupportDefinition => {
  if (end === 'fixed') return { type: 'fixed' };
  if (end === 'free') return { type: 'none' };
  if (end === 'roller') return { type: 'roller' };
  return { type: restrainsX ? 'pin' : 'roller' };
};

const hasPoint = (span: BeamSpanLoads) => span.pointDeadKn !== 0 || span.pointLiveKn !== 0;

/** Modelo 2D temporal: nodos en los apoyos, un miembro por claro y un caso por patrón de carga. */
function buildBeamProject(input: BeamAnalysisInput): ProjectModel {
  const base = createDefaultProject();
  const xs = [0];
  input.spans.forEach((span) => xs.push(xs[xs.length - 1]! + span.lengthM));
  const lastIndex = xs.length - 1;
  const nodes: NodeModel[] = xs.map((x, index) => ({
    id: `N${index}`,
    x,
    y: 0,
    support: index === 0
      ? supportFor(input.leftEnd, true)
      : index === lastIndex
        ? supportFor(input.rightEnd, input.leftEnd === 'free' || input.leftEnd === 'roller')
        : { type: 'roller' },
  }));
  const members = input.spans.map((_, index) => ({
    id: `S${index + 1}`,
    i: `N${index}`,
    j: `N${index + 1}`,
    type: 'frame' as const,
    E: input.elasticModulusKpa,
    A: input.areaM2,
    I: input.inertiaM4PerSpan?.[index] ?? input.inertiaM4,
  }));
  const memberLoads: MemberLoad[] = [];
  input.spans.forEach((span, index) => {
    const memberId = `S${index + 1}`;
    const uniform = (caseId: string, q: number) => {
      if (q !== 0) memberLoads.push({ id: `${caseId}-q-${memberId}`, memberId, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -q, qyEnd: -q });
    };
    const position = Math.min(1, Math.max(0, span.pointAtM / span.lengthM));
    const point = (caseId: string, p: number) => {
      if (p !== 0) memberLoads.push({ id: `${caseId}-p-${memberId}`, memberId, caseId, type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: position, end: position, position, px: 0, py: -p });
    };
    uniform(`D${index}`, span.deadKnPerM + input.selfWeightKnPerM);
    point(`D${index}`, span.pointDeadKn);
    uniform(`L${index}`, span.liveKnPerM);
    point(`L${index}`, span.pointLiveKn);
  });
  for (const [loadIndex, load] of (input.extraLoads ?? []).entries()) {
    const span = input.spans[load.spanIndex]!;
    const caseId = `${load.category === 'dead' ? 'D' : 'L'}${load.spanIndex}`;
    const memberId = `S${load.spanIndex + 1}`;
    const start = load.startM / span.lengthM;
    const end = load.endM / span.lengthM;
    if (load.kind === 'point') {
      const position = start;
      memberLoads.push({ id: `extra-${loadIndex}-${memberId}`, memberId, caseId, type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start, end: start, position, px: 0, py: -load.startKn });
    } else {
      memberLoads.push({ id: `extra-${loadIndex}-${memberId}`, memberId, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start, end, qyStart: -load.startKn, qyEnd: -load.endKn });
    }
  }
  return {
    ...base,
    id: 'design-workbench-beam',
    name: 'Viga del taller de diseño',
    nodes,
    members,
    loadCases: input.spans.flatMap((_, index) => [
      { id: `D${index}`, name: `Muerta claro ${index + 1}`, category: 'permanent' as const, active: true, selfWeightFactor: 0 },
      { id: `L${index}`, name: `Viva claro ${index + 1}`, category: 'variable' as const, active: true, selfWeightFactor: 0 },
    ]),
    combinations: [],
    nodalLoads: [],
    prescribedDisplacements: [],
    memberLoads,
    memberInitialEffects: [],
    nodeLinks: [],
    multiPointConstraints: [],
    generatedLoadSources: [],
    movingLoadCases: [],
    designAssignments: [],
  };
}

interface BeamStation { readonly x: number; readonly span: number; readonly local: number; readonly side: 'left' | 'right' }
type Station = BeamStation;

function sample(project: ProjectModel, result: AnalysisResult, stations: readonly Station[]): CaseResponse {
  const moment: number[] = [];
  const shear: number[] = [];
  const deflection: number[] = [];
  const byId = new Map(result.memberResults.map((member) => [member.memberId, member]));
  for (const station of stations) {
    const member = byId.get(project.members[station.span]!.id)!;
    const point = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, station.local, station.side);
    moment.push(point?.moment ?? 0);
    shear.push(point?.shear ?? 0);
    deflection.push(evaluateDeformationAt(member.deformationSegments, station.local)?.v ?? 0);
  }
  return { moment, shear, deflection };
}

/** Raíces reales de un polinomio cuadrático en coordenada local al corte. */
function quadraticRoots(coefficients: readonly [number, number, number]): number[] {
  const [constant, linear, quadratic] = coefficients;
  if (Math.abs(quadratic) < 1e-12) return Math.abs(linear) < 1e-12 ? [] : [-constant / linear];
  const discriminant = linear * linear - 4 * quadratic * constant;
  if (discriminant < -1e-10) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-linear - root) / (2 * quadratic), (-linear + root) / (2 * quadratic)];
}

/** Incluye raíces exactas de cortante desde los segmentos polinomiales del solver, no desde la grilla de dibujo. */
function withShearRoots(project: ProjectModel, deadResults: readonly AnalysisResult[], liveResults: readonly AnalysisResult[], stations: readonly Station[], combinations: readonly BeamAnalysisCombination[]): Station[] {
  const additions: Station[] = [];
  project.members.forEach((projectMember, spanIndex) => {
    const memberFor = (result: AnalysisResult) => result.memberResults.find((member) => member.memberId === projectMember.id);
    const cases = [
      ...deadResults.flatMap((result) => { const member = memberFor(result); return member ? [{ member, category: 'dead' as const }] : []; }),
      ...liveResults.flatMap((result) => { const member = memberFor(result); return member ? [{ member, category: 'live' as const }] : []; }),
    ];
    if (!cases.length) return;
    const startM = project.nodes[spanIndex]!.x;
    const spanLengthM = project.nodes[spanIndex + 1]!.x - startM;
    const breakpoints = [...new Set(cases.flatMap(({ member }) => [
      ...member.diagramSegments.flatMap((segment) => [segment.x0, segment.x1]),
      ...member.criticalPoints.filter((point) => point.quantity === 'moment' && point.kind === 'zero').map((point) => point.x),
    ]))].sort((left, right) => left - right);
    for (const combination of combinations) for (let index = 1; index < breakpoints.length; index += 1) {
      const a = breakpoints[index - 1]!;
      const b = breakpoints[index]!;
      if (b - a < 1e-8) continue;
      const middle = (a + b) / 2;
      const high = [0, 0, 0];
      const low = [0, 0, 0];
      for (const { member, category } of cases) {
        const segment = member.diagramSegments.find((candidate) => middle > candidate.x0 - 1e-9 && middle < candidate.x1 + 1e-9);
        if (!segment) continue;
        const dx = middle - segment.x0;
        const moment = segment.moment[0] + dx * (segment.moment[1] + dx * (segment.moment[2] + dx * segment.moment[3]));
        const factorHigh = category === 'dead'
          ? moment >= 0 ? combination.dead : combination.favorableDead
          : moment > 0 ? combination.live : 0;
        const factorLow = category === 'dead'
          ? moment >= 0 ? combination.favorableDead : combination.dead
          : moment < 0 ? combination.live : 0;
        const shift = a - segment.x0;
        const shiftedShear: [number, number, number] = [
          segment.shear[0] + shift * (segment.shear[1] + shift * segment.shear[2]),
          segment.shear[1] + 2 * shift * segment.shear[2],
          segment.shear[2],
        ];
        for (let coefficient = 0; coefficient < 3; coefficient += 1) {
          high[coefficient]! += factorHigh * shiftedShear[coefficient]!;
          low[coefficient]! += factorLow * shiftedShear[coefficient]!;
        }
      }
      for (const shear of [high, low]) for (const offset of quadraticRoots(shear as [number, number, number])) {
        if (offset <= 1e-8 || offset >= b - a - 1e-8) continue;
        const local = a + offset;
        if (local <= 1e-8 || local >= spanLengthM - 1e-8) continue;
        additions.push({ x: startM + local, span: spanIndex, local, side: 'left' });
      }
    }
  });
  const known = new Set(stations.map((station) => `${station.span}:${station.local.toFixed(9)}:${station.side}`));
  const uniqueAdditions = additions.filter((station) => {
    const key = `${station.span}:${station.local.toFixed(9)}:${station.side}`;
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  const merged = [...stations, ...uniqueAdditions];
  return merged.sort((left, right) => left.x - right.x || (left.side === 'left' ? -1 : 1));
}

/**
 * Estaciones uniformes por claro más la posición de la carga puntual. Los apoyos
 * interiores y las cargas puntuales quedan duplicados (lado izquierdo y derecho)
 * para que los saltos del cortante se dibujen y se evalúen sin suavizarse.
 */
export function buildStations(input: Pick<BeamAnalysisInput, 'spans' | 'extraLoads'>): Station[] {
  const stations: Station[] = [];
  let start = 0;
  input.spans.forEach((span, index) => {
    const locals = Array.from({ length: STATIONS_PER_SPAN + 1 }, (_, step) => span.lengthM * step / STATIONS_PER_SPAN);
    const extra = (input.extraLoads ?? []).filter((load) => load.spanIndex === index);
    const extraPositions = extra.flatMap((load) => load.kind === 'point' ? [load.startM] : [load.startM, load.endM]);
    const pointPositions = [...(hasPoint(span) ? [span.pointAtM] : []), ...extra.filter((load) => load.kind === 'point').map((load) => load.startM)];
    const breakpoints = [...extraPositions, ...pointPositions].filter((position) => Number.isFinite(position) && position >= 0 && position <= span.lengthM);
    for (const position of breakpoints) if (!locals.some((local) => Math.abs(local - position) < 1e-9)) locals.push(position);
    locals.sort((left, right) => left - right);
    const isPoint = (local: number) => pointPositions.some((position) => Math.abs(position - local) < 1e-9);
    for (const local of locals) {
      const x = start + local;
      if (isPoint(local) && local > 1e-9 && local < span.lengthM - 1e-9) {
        stations.push({ x, span: index, local, side: 'left' }, { x, span: index, local, side: 'right' });
      } else {
        stations.push({ x, span: index, local, side: local === 0 ? 'right' : 'left' });
      }
    }
    start += span.lengthM;
  });
  return stations;
}

export function analyzeBeam(input: BeamAnalysisInput): BeamAnalysisOutcome {
  if (input.leftEnd === 'roller' && input.rightEnd === 'roller') return { ok: false, error: 'Dos rodillos no estabilizan la viga en X; usa al menos un apoyo articulado o empotrado.' };
  if (input.leftEnd === 'free' && input.rightEnd === 'free') return { ok: false, error: 'Una viga con ambos extremos libres no tiene apoyos suficientes.' };
  if (input.spans.length === 1 && (input.leftEnd === 'free' || input.rightEnd === 'free') && input.leftEnd !== 'fixed' && input.rightEnd !== 'fixed') {
    return { ok: false, error: 'Un voladizo necesita el otro extremo empotrado.' };
  }
  const invalidPoint = input.spans.findIndex((span) => hasPoint(span) && (!Number.isFinite(span.pointAtM) || span.pointAtM < 0 || span.pointAtM > span.lengthM));
  if (invalidPoint >= 0) return { ok: false, error: `Claro ${invalidPoint + 1}: la carga puntual debe quedar dentro del claro (0 a ${input.spans[invalidPoint]!.lengthM} m).` };
  const invalidExtra = (input.extraLoads ?? []).findIndex((load) => {
    const span = input.spans[load.spanIndex];
    return !span || !Number.isFinite(load.startM) || !Number.isFinite(load.endM) || load.startM < 0 || load.endM > span.lengthM
      || (load.kind === 'point' ? load.startM !== load.endM || load.startKn !== load.endKn : load.endM <= load.startM)
      || !Number.isFinite(load.startKn) || !Number.isFinite(load.endKn);
  });
  if (invalidExtra >= 0) return { ok: false, error: `La carga adicional ${invalidExtra + 1} tiene magnitud o posición inválida.` };

  const project = buildBeamProject(input);
  let stations = buildStations(input);
  const run = (factors: Record<string, number>) => analyzeProject(project, { id: 'pattern', name: 'Patrón', factors }, { includeEducationTrace: false });

  const deadResults: AnalysisResult[] = [];
  const liveResults: AnalysisResult[] = [];
  for (let index = 0; index < input.spans.length; index += 1) {
    const dead = run({ [`D${index}`]: 1 });
    if (!dead.success) {
      const message = dead.issues.find((issue) => issue.severity === 'error')?.message ?? 'El solver 2D no pudo resolver la viga.';
      return { ok: false, error: message };
    }
    deadResults.push(dead);
    const live = run({ [`L${index}`]: 1 });
    if (!live.success) return { ok: false, error: 'El solver 2D no pudo resolver un patrón de carga viva.' };
    liveResults.push(live);
  }
  // Sin acciones generales nuevas, el refinamiento parabólico existente de
  // beam.ts cubre los casos heredados uniformes y la carga puntual conserva
  // sus dos caras sin calcular raíces de combinaciones que no hacen falta.
  if (input.extraLoads?.length) {
    stations = withShearRoots(project, deadResults, liveResults, stations, input.combinations ?? [{ dead: 1, favorableDead: 1, live: 1 }]);
  }
  const deadPerSpan = deadResults.map((result) => sample(project, result, stations));
  const livePerSpan = liveResults.map((result) => sample(project, result, stations));
  return {
    ok: true,
    analysis: {
      stations: stations.map((station) => station.x),
      stationSpan: stations.map((station) => station.span),
      nodesAtM: project.nodes.map((node) => node.x),
      totalLengthM: project.nodes[project.nodes.length - 1]!.x,
      deadPerSpan,
      livePerSpan,
      solverRuns: 2 * input.spans.length,
    },
  };
}
