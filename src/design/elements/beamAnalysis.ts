import { createDefaultProject } from '../../data/defaultProject';
import { evaluateDeformationAt, evaluateDiagramAt } from '../../engine/diagram';
import { analyzeProject } from '../../engine/solver';
import type { AnalysisResult, MemberLoad, NodeModel, ProjectModel, SupportDefinition } from '../../types';

export type BeamEnd = 'pin' | 'fixed' | 'free';

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

interface BeamAnalysisInput {
  readonly spans: readonly BeamSpanLoads[];
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
  readonly solverRuns: number;
}

type BeamAnalysisOutcome = { readonly ok: true; readonly analysis: BeamAnalysis } | { readonly ok: false; readonly error: string };

const STATIONS_PER_SPAN = 96;

const supportFor = (end: BeamEnd, restrainsX: boolean): SupportDefinition => {
  if (end === 'fixed') return { type: 'fixed' };
  if (end === 'free') return { type: 'none' };
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
        ? supportFor(input.rightEnd, input.leftEnd === 'free')
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

interface Station { readonly x: number; readonly span: number; readonly local: number; readonly side: 'left' | 'right' }

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

/**
 * Estaciones uniformes por claro más la posición de la carga puntual. Los apoyos
 * interiores y las cargas puntuales quedan duplicados (lado izquierdo y derecho)
 * para que los saltos del cortante se dibujen y se evalúen sin suavizarse.
 */
function buildStations(input: BeamAnalysisInput): Station[] {
  const stations: Station[] = [];
  let start = 0;
  input.spans.forEach((span, index) => {
    const locals = Array.from({ length: STATIONS_PER_SPAN + 1 }, (_, step) => span.lengthM * step / STATIONS_PER_SPAN);
    const pointAt = hasPoint(span) ? Math.min(span.lengthM, Math.max(0, span.pointAtM)) : undefined;
    const interior = pointAt !== undefined && pointAt > 1e-9 && pointAt < span.lengthM - 1e-9;
    if (interior && !locals.some((local) => Math.abs(local - pointAt) < 1e-9)) {
      locals.push(pointAt);
      locals.sort((left, right) => left - right);
    }
    for (const local of locals) {
      const x = start + local;
      if (interior && Math.abs(local - pointAt) < 1e-9) {
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
  if (input.leftEnd === 'free' && input.rightEnd === 'free') return { ok: false, error: 'Una viga con ambos extremos libres no tiene apoyos suficientes.' };
  if (input.spans.length === 1 && (input.leftEnd === 'free' || input.rightEnd === 'free') && input.leftEnd !== 'fixed' && input.rightEnd !== 'fixed') {
    return { ok: false, error: 'Un voladizo necesita el otro extremo empotrado.' };
  }
  const invalidPoint = input.spans.findIndex((span) => hasPoint(span) && (!Number.isFinite(span.pointAtM) || span.pointAtM < 0 || span.pointAtM > span.lengthM));
  if (invalidPoint >= 0) return { ok: false, error: `Claro ${invalidPoint + 1}: la carga puntual debe quedar dentro del claro (0 a ${input.spans[invalidPoint]!.lengthM} m).` };

  const project = buildBeamProject(input);
  const stations = buildStations(input);
  const run = (factors: Record<string, number>) => analyzeProject(project, { id: 'pattern', name: 'Patrón', factors }, { includeEducationTrace: false });

  const deadPerSpan: CaseResponse[] = [];
  const livePerSpan: CaseResponse[] = [];
  for (let index = 0; index < input.spans.length; index += 1) {
    const dead = run({ [`D${index}`]: 1 });
    if (!dead.success) {
      const message = dead.issues.find((issue) => issue.severity === 'error')?.message ?? 'El solver 2D no pudo resolver la viga.';
      return { ok: false, error: message };
    }
    deadPerSpan.push(sample(project, dead, stations));
    const live = run({ [`L${index}`]: 1 });
    if (!live.success) return { ok: false, error: 'El solver 2D no pudo resolver un patrón de carga viva.' };
    livePerSpan.push(sample(project, live, stations));
  }
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
