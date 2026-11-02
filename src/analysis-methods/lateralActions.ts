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
 *  - a horizontal load on a column (wind on its face, distributed or concentrated) is converted
 *    into equivalent joint loads at the two floor levels the column segment spans: the segment is
 *    read as a beam simply supported between those levels and its resultant is split between them
 *    by statics (ΣM about each end). That split is part of the approximation, and it is declared
 *    in `conversions` so the report can narrate it; the part that lands on the foundation level
 *    goes straight into the base support. Its vertical part, if any, runs along the column and is
 *    declared like any other;
 *  - a member load with a horizontal component on a beam (a sloping push) is a lateral action this
 *    idealisation has nowhere to put, and the model is refused; so is a concentrated couple on a
 *    member, which belongs to neither family.
 *
 * The grid is required first (`buildFrameGrid`): every member is then exactly vertical or exactly
 * horizontal, which is what makes «no horizontal component» mean «gravity» here.
 */
import { withResolvedGeneratedLoads } from '../engine/generatedLoads';
import { selectedFactors } from '../engine/solver';
import type { LoadCombination, MemberLoad, ProjectModel } from '../types';
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

/**
 * A horizontal load on a column segment, turned into two joint loads at the levels it spans.
 *
 * The segment is a beam simply supported between its bottom and top levels: its resultant W acts
 * at height z̄ above the bottom, so the top level takes W·z̄/h and the bottom one W·(h − z̄)/h.
 */
export interface LateralConversion {
  loadId: string;
  memberId: string;
  kind: 'distributed' | 'point';
  /** Combined factor of the cases that carry it. */
  factor: number;
  bottomNodeId: string;
  topNodeId: string;
  /** Storey of the segment (1 = above the foundation) and its height, m. */
  story: number;
  height: number;
  /** Factored horizontal intensities (distributed: at the lower and upper end of the loaded stretch, kN/m) or force (point, kN). */
  intensityLow?: number;
  intensityHigh?: number;
  /** Loaded stretch, as heights above the bottom level, m. */
  from: number;
  to: number;
  /** Resultant W (kN, +x positive) and its height above the bottom level, m. */
  resultant: number;
  /** ∫ q·z dz about the bottom level, kN·m: W·z̄, defined even when W = 0. */
  momentAboutBottom: number;
  centroid?: number;
  toTop: number;
  toBottom: number;
}

type LateralActionSplit =
  | {
    applicable: true;
    /** Factored horizontal joint load per node, kN: what the method distributes (nodal loads and conversions). */
    nodalFx: Map<string, number>;
    /** The nodal part alone, as applied in the model. */
    directFx: Map<string, number>;
    /** Column loads turned into joint loads, in the order they were read. */
    conversions: LateralConversion[];
    /** Their horizontal parts as factored global member loads, for the exact lateral-only run. */
    lateralMemberLoads: MemberLoad[];
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
  const segmentOf = new Map(grid.columns.flatMap((line) => line.flatMap((column, story) => (column ? [[column.memberId, { column, story }] as const] : []))));
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const memberById = new Map(project.members.map((member) => [member.id, member]));

  const excluded: ExcludedAction[] = [];
  const conversions: LateralConversion[] = [];
  const lateralMemberLoads: MemberLoad[] = [];
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
    const globalX = ([x, y]: [number, number]) => (load.coordinateSystem === 'local' ? c * x - s * y : x);
    const globalY = ([x, y]: [number, number]) => (load.coordinateSystem === 'local' ? s * x + c * y : y);
    const horizontal = vectors.some((vector) => Math.abs(globalX(vector)) > HORIZONTAL_TOLERANCE * Math.max(Math.hypot(...vector), 1e-300));
    const vertical = vectors.some((vector) => Math.abs(globalY(vector)) > HORIZONTAL_TOLERANCE * Math.max(Math.hypot(...vector), 1e-300));
    if (horizontal) {
      // Only a column can hand a horizontal load to the floor levels by statics.
      const segment = segmentOf.get(member.id);
      if (!segment) return { applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' };
      const { column, story } = segment;
      const h = column.height;
      // Height above the bottom level of a station u (fraction from node i) along the column.
      const height = (u: number) => (member.i === column.bottomNodeId ? u * h : (1 - u) * h);
      // A column is vertical: a basis of «horizontal projection» has no length on it.
      const basis = load.lengthBasis === 'horizontal' ? 0 : 1;
      let conversion: LateralConversion;
      if (load.type === 'point') {
        const force = globalX(vectors[0]!) * factor;
        const z = height(Math.min(1, Math.max(0, load.position ?? 0.5)));
        conversion = {
          loadId: load.id, memberId: member.id, kind: 'point', factor, bottomNodeId: column.bottomNodeId, topNodeId: column.topNodeId,
          story, height: h, intensityLow: force, intensityHigh: force, from: z, to: z,
          resultant: force, momentAboutBottom: force * z, centroid: z, toTop: (force * z) / h, toBottom: force - (force * z) / h,
        };
      } else {
        const [a, b] = [Math.min(load.start, load.end), Math.max(load.start, load.end)];
        const qa = globalX(vectors[0]!) * factor * basis;
        const qb = globalX(vectors[1]!) * factor * basis;
        const za = height(a);
        const zb = height(b);
        // Intensity is linear along the column; order the stretch from bottom to top.
        const [low, high, qLow, qHigh] = za <= zb ? [za, zb, qa, qb] : [zb, za, qb, qa];
        const span = high - low;
        const resultant = ((qLow + qHigh) / 2) * span;
        // ∫ q z dz over [low, high] with q linear: span·[qLow(2low + high) + qHigh(low + 2high)]/6.
        const momentAboutBottom = (span * (qLow * (2 * low + high) + qHigh * (low + 2 * high))) / 6;
        conversion = {
          loadId: load.id, memberId: member.id, kind: 'distributed', factor, bottomNodeId: column.bottomNodeId, topNodeId: column.topNodeId,
          story, height: h, intensityLow: qLow, intensityHigh: qHigh, from: low, to: high,
          resultant, momentAboutBottom,
          ...(Math.abs(resultant) > 0 ? { centroid: momentAboutBottom / resultant } : {}),
          toTop: momentAboutBottom / h, toBottom: resultant - momentAboutBottom / h,
        };
      }
      conversions.push(conversion);
      // The exact run carries the horizontal part as it is: on the column, not at the joints.
      lateralMemberLoads.push(load.type === 'point'
        ? { id: `LATERAL-${load.id}`, memberId: member.id, caseId: 'LATERAL', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: load.start, end: load.end, position: load.position, px: conversion.resultant, py: 0 }
        : {
          id: `LATERAL-${load.id}`, memberId: member.id, caseId: 'LATERAL', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
          start: load.start, end: load.end,
          qxStart: globalX(vectors[0]!) * factor * basis, qxEnd: globalX(vectors[1]!) * factor * basis, qyStart: 0, qyEnd: 0,
        });
      if (vertical) excluded.push({ kind: 'column-axial', loadId: load.id, memberId: member.id, factor });
      continue;
    }
    if (vectors.every(([x, y]) => x === 0 && y === 0)) continue;
    excluded.push({ kind: columnIds.has(member.id) ? 'column-axial' : 'beam-gravity', loadId: load.id, memberId: member.id, factor });
  }

  const selfWeightFactor = project.loadCases.reduce((sum, loadCase) => sum + factorOf(loadCase.id) * (loadCase.selfWeightFactor ?? 0), 0);
  if (selfWeightFactor !== 0 && project.members.some((member) => (member.density ?? 0) > 0 && member.A > 0)) {
    excluded.push({ kind: 'self-weight', loadId: 'peso propio', factor: selfWeightFactor });
  }

  const directFx = new Map<string, number>();
  for (const load of project.nodalLoads) {
    const factor = factorOf(load.caseId);
    if (factor === 0) continue;
    if (load.fx !== 0) directFx.set(load.nodeId, (directFx.get(load.nodeId) ?? 0) + factor * load.fx);
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

  const nodalFx = new Map(directFx);
  const addAt = (nodeId: string, value: number) => {
    if (value !== 0) nodalFx.set(nodeId, (nodalFx.get(nodeId) ?? 0) + value);
  };
  for (const conversion of conversions) {
    addAt(conversion.topNodeId, conversion.toTop);
    addAt(conversion.bottomNodeId, conversion.toBottom);
  }

  return { applicable: true, nodalFx, directFx, conversions, lateralMemberLoads, excluded };
};

/** Lateral load applied at the foundation level: it goes straight into the base support. */
export const baseLevelFx = (grid: FrameGrid, nodalFx: ReadonlyMap<string, number>, line: number): number =>
  nodalFx.get(grid.nodeGrid[line]![0]!) ?? 0;

/**
 * The project with nothing but the lateral actions this method distributes, as one active case:
 * the honest oracle for the approximate method, because the method never claimed to carry the
 * gravity actions it declared excluded. Loads on the columns stay on the columns, as they are:
 * turning them into joint loads is part of the approximation the comparison has to show.
 */
export const lateralOnlyProject = (
  project: ProjectModel,
  nodalFx: ReadonlyMap<string, number>,
  memberLoads: readonly MemberLoad[] = [],
): ProjectModel => ({
  ...project,
  loadCases: [{ id: 'LATERAL', name: 'lateral', category: 'other', active: true, selfWeightFactor: 0 }],
  combinations: [],
  memberLoads: [...memberLoads],
  nodalLoads: Array.from(nodalFx, ([nodeId, fx]) => ({
    id: `LATERAL-${nodeId}`, nodeId, caseId: 'LATERAL', fx, fy: 0, mz: 0,
  })),
  prescribedDisplacements: [],
  memberInitialEffects: [],
  // A Winkler foundation is stiffness, not load: it stays. Every load-generating source goes.
  generatedLoadSources: (project.generatedLoadSources ?? []).filter((source) => source.kind === 'elastic-foundation'),
  movingLoadCases: [],
});
