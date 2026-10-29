import * as straight from './linearModelOperations';
import type { MemberModel, ProjectModel } from '../types';
import { circularMemberGeometry, curvePointAt, curveRatioAtPoint, curveTangentAt, validateMemberCurve } from '../graphics/memberCurve';
export * from './linearModelOperations';

export const memberInteriorRatioAtPoint: typeof straight.memberInteriorRatioAtPoint = (project, member, point, tolerance = straight.projectTopologyTolerance(project)) => {
  if (!member.curve) return straight.memberInteriorRatioAtPoint(project, member, point, tolerance);
  const i = project.nodes.find(n => n.id === member.i), j = project.nodes.find(n => n.id === member.j);
  if (!i || !j) return null;
  const arc = circularMemberGeometry(member, i, j)!, ratio = curveRatioAtPoint(arc, point);
  const endTolerance = Math.max(1e-8, tolerance / arc.length);
  if (ratio <= endTolerance || ratio >= 1 - endTolerance) return null;
  const closest = curvePointAt(arc, ratio);
  return Math.hypot(closest.x - point.x, closest.y - point.y) <= tolerance ? ratio : null;
};

/** Only an explicit split/add-joint action introduces another physical node. */
export const splitMemberAt: typeof straight.splitMemberAt = (project, memberId, ratio) => {
  const original = project.members.find(m => m.id === memberId);
  if (!original?.curve) return straight.splitMemberAt(project, memberId, ratio);
  if ((original.rigidOffsetI ?? 0) || (original.rigidOffsetJ ?? 0)) throw new Error('La división de curvas con zonas rígidas no está verificada.');
  const i = project.nodes.find(n => n.id === original.i), j = project.nodes.find(n => n.id === original.j);
  if (!i || !j) throw new Error('Faltan los extremos de la curva.');
  const arc = circularMemberGeometry(original, i, j)!;
  const left = validateMemberCurve({ kind: 'circular-arc', bulge: Math.tan(Math.atan(original.curve.bulge) * ratio) });
  const right = validateMemberCurve({ kind: 'circular-arc', bulge: Math.tan(Math.atan(original.curve.bulge) * (1 - ratio)) });
  const draft = structuredClone(project);
  // The established load remapper can work in normalized arc stations when
  // offsets are zero. Convert a point force at the cut using its true tangent.
  for (const load of draft.memberLoads) if (load.memberId === memberId && load.type === 'point'
    && load.coordinateSystem === 'local' && Math.abs((load.position ?? 0.5) - ratio) <= 1e-10) {
    const t = curveTangentAt(arc, ratio), px = load.px ?? 0, py = load.py ?? 0;
    load.coordinateSystem = 'global'; load.px = t.x * px - t.y * py; load.py = t.y * px + t.x * py;
  }
  const result = straight.splitMemberAt(draft, memberId, ratio);
  Object.assign(draft.nodes.find(n => n.id === result.nodeId)!, curvePointAt(arc, ratio));
  draft.members.find(m => m.id === result.firstMemberId)!.curve = left;
  draft.members.find(m => m.id === result.secondMemberId)!.curve = right;
  Object.assign(project, draft);
  return result;
};

const splitIntoExisting = (project: ProjectModel, memberId: string, ratio: number, nodeId: string) => {
  const result = splitMemberAt(project, memberId, ratio), temporary = result.nodeId;
  for (const member of project.members) {
    if (member.i === temporary) member.i = nodeId;
    if (member.j === temporary) member.j = nodeId;
  }
  for (const load of project.nodalLoads) if (load.nodeId === temporary) load.nodeId = nodeId;
  project.nodes = project.nodes.filter(n => n.id !== temporary);
  return { ...result, nodeId };
};

export const ensureNodeAtPoint: typeof straight.ensureNodeAtPoint = (project, point) => {
  if (!project.members.some(m => m.curve)) return straight.ensureNodeAtPoint(project, point);
  const tolerance = straight.projectTopologyTolerance(project);
  const existing = project.nodes.find(n => Math.hypot(n.x - point.x, n.y - point.y) <= tolerance);
  if (existing) return { nodeId: existing.id, created: false };
  const containing = project.members.find(m => m.type !== 'rigid' && memberInteriorRatioAtPoint(project, m, point, tolerance) !== null);
  if (!containing) {
    const nodeId = straight.nextEntityId('N', project.nodes.map(n => n.id));
    project.nodes.push({ id: nodeId, ...point, support: { type: 'none' } });
    return { nodeId, created: true };
  }
  const result = splitMemberAt(project, containing.id, memberInteriorRatioAtPoint(project, containing, point, tolerance)!);
  const node = project.nodes.find(n => n.id === result.nodeId)!;
  for (const member of project.members.slice()) {
    if (member.type === 'rigid' || member.i === node.id || member.j === node.id) continue;
    const ratio = memberInteriorRatioAtPoint(project, member, node, tolerance);
    if (ratio !== null) splitIntoExisting(project, member.id, ratio, node.id);
  }
  return { nodeId: result.nodeId, created: true, splitMemberId: containing.id };
};

export const createMemberAtPoint: typeof straight.createMemberAtPoint = (project, input) => {
  if (!project.members.some(m => m.curve) && !input.template.curve) return straight.createMemberAtPoint(project, input);
  const start = project.nodes.find(n => n.id === input.startNodeId);
  if (!start) throw new Error(`No existe el nodo ${input.startNodeId}.`);
  if (Math.hypot(input.point.x - start.x, input.point.y - start.y) <= 1e-10) throw new Error('Los extremos del miembro deben estar separados.');
  const endpoint = ensureNodeAtPoint(project, input.point);
  const existing = project.members.find(m => {
    const direct = m.i === start.id && m.j === endpoint.nodeId;
    const reverse = m.j === start.id && m.i === endpoint.nodeId;
    if (!direct && !reverse) return false;
    return (m.curve?.bulge ?? 0) * (direct ? 1 : -1) === (input.template.curve?.bulge ?? 0);
  });
  if (existing) return { memberId: existing.id, nodeId: endpoint.nodeId, created: false };
  const memberId = straight.nextEntityId('M', project.members.map(m => m.id));
  const member: MemberModel = { id: memberId, i: start.id, j: endpoint.nodeId, ...structuredClone(input.template) };
  if (member.curve) circularMemberGeometry(member, start, project.nodes.find(n => n.id === endpoint.nodeId)!);
  project.members.push(member);
  return { memberId, nodeId: endpoint.nodeId, created: true };
};

/** Repairs actual intersections; the invisible chord of an arc is not a member. */
export const repairProjectTopology: typeof straight.repairProjectTopology = project => {
  if (!project.members.some(m => m.curve)) return straight.repairProjectTopology(project);
  const report: straight.TopologyRepairReport = { mergedNodes: [], splitMembers: [], skippedCoincidentPairs: [] };
  let merged = true;
  while (merged) {
    merged = false;
    const tolerance = straight.projectTopologyTolerance(project);
    for (let i = 0; i < project.nodes.length && !merged; i++) for (let j = i + 1; j < project.nodes.length; j++) {
      const a = project.nodes[i], b = project.nodes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > tolerance) continue;
      try { report.mergedNodes.push(straight.mergeCoincidentNodes(project, a.id, b.id)); merged = true; break; }
      catch { report.skippedCoincidentPairs.push({ firstNodeId: a.id, secondNodeId: b.id }); }
    }
  }
  for (const node of project.nodes.slice()) {
    if (!straight.nodeHasStructuralActivity(project, node)) continue;
    for (const member of project.members.slice()) {
      if (member.type === 'rigid' || member.i === node.id || member.j === node.id) continue;
      const ratio = memberInteriorRatioAtPoint(project, member, node);
      if (ratio === null) continue;
      try { report.splitMembers.push({ ...splitIntoExisting(project, member.id, ratio, node.id), originalMemberId: member.id }); }
      catch { /* Ambiguous joins are left untouched for explicit review. */ }
    }
  }
  return report;
};
