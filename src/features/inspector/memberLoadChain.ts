import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import { memberAxis, toGlobalVector } from '../../graphics/structureGeometry';

export interface StraightChainMember {
  member: MemberModel;
  reversed: boolean;
  pathStart: number;
  pathEnd: number;
}

const EPS = 1e-6;

const connectedMembers = (project: ProjectModel, nodeId: string, excludedId: string): MemberModel[] =>
  project.members.filter((member) => member.id !== excludedId && member.type === 'frame' && (member.i === nodeId || member.j === nodeId));

const vectorFrom = (member: MemberModel, nodeId: string, nodes: Map<string, NodeModel>) => {
  const otherId = member.i === nodeId ? member.j : member.i;
  const start = nodes.get(nodeId); const end = nodes.get(otherId);
  if (!start || !end) return null;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return length > EPS ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : null;
};

/** Finds the unbranched collinear run containing a member, stopping at bends. */
export const straightMemberChain = (project: ProjectModel, seedId: string): StraightChainMember[] => {
  const seed = project.members.find((member) => member.id === seedId);
  if (!seed || seed.type !== 'frame') return [];
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const seedAxis = memberAxis(seed, nodes.get(seed.i)!, nodes.get(seed.j)!);
  const forward = { x: seedAxis.c, y: seedAxis.s };
  const before: Array<{ member: MemberModel; reversed: boolean }> = [];
  const after: Array<{ member: MemberModel; reversed: boolean }> = [];

  let cursor = seed.i;
  let previous = seed.id;
  while (true) {
    const next = connectedMembers(project, cursor, previous).filter((member) => {
      const vector = vectorFrom(member, cursor, nodes);
      return vector && vector.x * forward.x + vector.y * forward.y < -1 + EPS;
    });
    if (next.length !== 1) break;
    const member = next[0];
    before.unshift({ member, reversed: member.i === cursor });
    previous = member.id;
    cursor = member.i === cursor ? member.j : member.i;
  }

  cursor = seed.j;
  previous = seed.id;
  while (true) {
    const next = connectedMembers(project, cursor, previous).filter((member) => {
      const vector = vectorFrom(member, cursor, nodes);
      return vector && vector.x * forward.x + vector.y * forward.y > 1 - EPS;
    });
    if (next.length !== 1) break;
    const member = next[0];
    after.push({ member, reversed: member.j === cursor });
    previous = member.id;
    cursor = member.i === cursor ? member.j : member.i;
  }

  let distance = 0;
  return [...before, { member: seed, reversed: false }, ...after].flatMap(({ member, reversed }) => {
    const start = nodes.get(member.i); const end = nodes.get(member.j);
    if (!start || !end) return [];
    const length = memberAxis(member, start, end).flexibleLength;
    if (!(length > EPS)) return [];
    const entry = { member, reversed, pathStart: distance, pathEnd: distance + length };
    distance += length;
    return [entry];
  });
};

export const splitDistributedLoadAcrossChain = (project: ProjectModel, loadId: string): ProjectModel => {
  const load = project.memberLoads.find((item) => item.id === loadId);
  if (!load || load.type !== 'distributed') return project;
  const chain = straightMemberChain(project, load.memberId);
  if (chain.length < 2) return project;
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const baseMember = project.members.find((member) => member.id === load.memberId);
  if (!baseMember) return project;
  const baseAxis = memberAxis(baseMember, nodes.get(baseMember.i)!, nodes.get(baseMember.j)!);
  const total = chain.at(-1)!.pathEnd;
  const sourceVector = (ratio: number) => toGlobalVector(baseAxis, load.coordinateSystem,
    (load.qxStart ?? 0) + ((load.qxEnd ?? load.qxStart ?? 0) - (load.qxStart ?? 0)) * ratio,
    (load.qyStart ?? 0) + ((load.qyEnd ?? load.qyStart ?? 0) - (load.qyStart ?? 0)) * ratio,
  );
  const used = new Set(project.memberLoads.map((item) => item.id));
  const nextId = (prefix: string) => {
    let id = prefix; let suffix = 2;
    while (used.has(id)) { id = `${prefix}-${suffix}`; suffix += 1; }
    used.add(id); return id;
  };
  const segments = chain.map((entry) => {
    const startRatio = entry.pathStart / total;
    const endRatio = entry.pathEnd / total;
    const [gxStart, gyStart] = sourceVector(startRatio);
    const [gxEnd, gyEnd] = sourceVector(endRatio);
    const start = nodes.get(entry.member.i)!; const end = nodes.get(entry.member.j)!;
    const axis = memberAxis(entry.member, start, end);
    const local = load.coordinateSystem === 'global'
      ? { qxStart: gxStart, qyStart: gyStart, qxEnd: gxEnd, qyEnd: gyEnd }
      : {
        qxStart: axis.c * gxStart + axis.s * gyStart,
        qyStart: -axis.s * gxStart + axis.c * gyStart,
        qxEnd: axis.c * gxEnd + axis.s * gyEnd,
        qyEnd: -axis.s * gxEnd + axis.c * gyEnd,
      };
    return { ...load, ...local, id: nextId(`${load.id}-tramo`), memberId: entry.member.id, start: 0, end: 1 };
  });
  return { ...project, memberLoads: project.memberLoads.flatMap((item) => item.id === load.id ? segments : [item]) };
};
