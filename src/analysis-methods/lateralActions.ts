/**
 * Which of a combination's actions the Portal and Cantilever methods analyse, and which ones they
 * leave to a separate gravity analysis.
 *
 * Both methods are, by construction, procedures for *lateral* load on a rectangular frame: their
 * hypotheses (an inflection point at mid-height of every column, a storey shear shared among the
 * columns) say nothing about the vertical loads a building also carries. Textbook practice is to
 * analyse the lateral loads this way and the gravity loads separately — by Cross, by the matrix
 * method — and superpose the two. Refusing every model with a beam load, as these methods used
 * to, meant refusing every frame a user actually builds.
 *
 * So the combination is split here, from the project data alone:
 *
 *  - the horizontal component of every joint load is the lateral action the method distributes;
 *  - a member load with no horizontal component is a gravity action: on a beam it is a vertical
 *    load across the span, on a column it runs along the column's own axis. Neither pushes the
 *    frame sideways in this idealisation, so neither is analysed, and both are *declared*;
 *  - self-weight, the vertical component and the moment of joint loads, initial effects and
 *    imposed support displacements are declared the same way;
 *  - a member load with a horizontal component (wind on a column, a sloping push on a beam) is a
 *    lateral action this idealisation has nowhere to put — the method does not convert it into
 *    joint loads by tributary area behind the reader's back — and the model is refused; so is a
 *    concentrated couple on a member, which belongs to neither family.
 *
 * The grid is required first (`buildFrameGrid`): every member is then exactly vertical or exactly
 * horizontal, which is what makes «no horizontal component» mean «gravity» here.
 */
import { withResolvedGeneratedLoads } from '../engine/generatedLoads';
import { selectedFactors } from '../engine/solver';
import type { LoadCombination, ProjectModel } from '../types';
import type { FrameGrid } from './frameGeometry';

/** An action this lateral analysis leaves out, to be superposed from a gravity analysis. */
export interface ExcludedAction {
  kind: 'beam-gravity' | 'column-axial' | 'self-weight' | 'nodal-vertical' | 'nodal-moment' | 'initial-effect' | 'imposed-displacement';
  /** Load id in the project; `peso propio` for self-weight. */
  loadId: string;
  memberId?: string;
  nodeId?: string;
  /** Combined factor of the cases that carry it (for self-weight, Σ factor × self-weight factor). */
  factor: number;
}

type LateralActionSplit =
  | {
    applicable: true;
    /** Factored horizontal joint load per node, kN: what the method distributes. */
    nodalFx: Map<string, number>;
    excluded: ExcludedAction[];
  }
  | { applicable: false; reasonKey: string };

/** Relative size under which a horizontal component is rounding, not load. */
const HORIZONTAL_TOLERANCE = 1e-9;

export const splitLateralActions = (
  project: ProjectModel,
  combination: LoadCombination | null,
  grid: FrameGrid,
): LateralActionSplit => {
  const factors = selectedFactors(project, combination);
  const factorOf = (caseId: string) => factors[caseId] ?? 0;
  // The same projection the solver analyses: generated sources become ordinary member loads, so
  // wind generated on a column is seen — and refused — like wind typed on it by hand.
  const resolved = withResolvedGeneratedLoads(project);

  const columnIds = new Set(grid.columns.flat().flatMap((column) => (column ? [column.memberId] : [])));
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const memberById = new Map(project.members.map((member) => [member.id, member]));

  const excluded: ExcludedAction[] = [];
  for (const load of resolved.memberLoads) {
    const factor = factorOf(load.caseId);
    if (factor === 0) continue;
    const member = memberById.get(load.memberId);
    const ni = member ? nodeById.get(member.i) : undefined;
    const nj = member ? nodeById.get(member.j) : undefined;
    if (!member || !ni || !nj) continue;
    if (load.type === 'moment') {
      if ((load.moment ?? 0) !== 0) return { applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' };
      continue;
    }
    const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
    const c = (nj.x - ni.x) / length;
    const s = (nj.y - ni.y) / length;
    // Global components of the load at each place it is defined (start and end of a distributed
    // load; the point of a concentrated one).
    const vectors: Array<[number, number]> = load.type === 'point'
      ? [[load.px ?? 0, load.py ?? 0]]
      : [[load.qxStart ?? 0, load.qyStart ?? 0], [load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0]];
    const horizontal = vectors.some(([x, y]) => {
      const gx = load.coordinateSystem === 'local' ? c * x - s * y : x;
      return Math.abs(gx) > HORIZONTAL_TOLERANCE * Math.max(Math.hypot(x, y), 1e-300);
    });
    if (horizontal) return { applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' };
    if (vectors.every(([x, y]) => x === 0 && y === 0)) continue;
    excluded.push({ kind: columnIds.has(member.id) ? 'column-axial' : 'beam-gravity', loadId: load.id, memberId: member.id, factor });
  }

  const selfWeightFactor = project.loadCases.reduce((sum, loadCase) => sum + factorOf(loadCase.id) * (loadCase.selfWeightFactor ?? 0), 0);
  if (selfWeightFactor !== 0 && project.members.some((member) => (member.density ?? 0) > 0 && member.A > 0)) {
    excluded.push({ kind: 'self-weight', loadId: 'peso propio', factor: selfWeightFactor });
  }

  const nodalFx = new Map<string, number>();
  for (const load of project.nodalLoads) {
    const factor = factorOf(load.caseId);
    if (factor === 0) continue;
    if (load.fx !== 0) nodalFx.set(load.nodeId, (nodalFx.get(load.nodeId) ?? 0) + factor * load.fx);
    if (load.fy !== 0) excluded.push({ kind: 'nodal-vertical', loadId: load.id, nodeId: load.nodeId, factor });
    if (load.mz !== 0) excluded.push({ kind: 'nodal-moment', loadId: load.id, nodeId: load.nodeId, factor });
  }

  for (const effect of resolved.memberInitialEffects ?? []) {
    const factor = factorOf(effect.caseId);
    if (factor !== 0) excluded.push({ kind: 'initial-effect', loadId: effect.id, memberId: effect.memberId, factor });
  }
  for (const entry of project.prescribedDisplacements ?? []) {
    const factor = factorOf(entry.caseId);
    if (factor !== 0 && entry.value !== 0) excluded.push({ kind: 'imposed-displacement', loadId: entry.id, nodeId: entry.nodeId, factor });
  }

  return { applicable: true, nodalFx, excluded };
};

/**
 * The project with nothing but the lateral joint loads this method distributes, as one active
 * case: the honest oracle for the approximate method, because the method never claimed to carry
 * the gravity actions it declared excluded.
 */
export const lateralOnlyProject = (project: ProjectModel, nodalFx: ReadonlyMap<string, number>): ProjectModel => ({
  ...project,
  loadCases: [{ id: 'LATERAL', name: 'lateral', category: 'other', active: true, selfWeightFactor: 0 }],
  combinations: [],
  memberLoads: [],
  nodalLoads: Array.from(nodalFx, ([nodeId, fx]) => ({
    id: `LATERAL-${nodeId}`, nodeId, caseId: 'LATERAL', fx, fy: 0, mz: 0,
  })),
  prescribedDisplacements: [],
  memberInitialEffects: [],
  // A Winkler foundation is stiffness, not load: it stays. Every load-generating source goes.
  generatedLoadSources: (project.generatedLoadSources ?? []).filter((source) => source.kind === 'elastic-foundation'),
  movingLoadCases: [],
});
