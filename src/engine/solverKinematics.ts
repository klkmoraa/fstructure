import type { MemberModel, NodeModel, ProjectModel } from '../types';

export interface Geometry {
  L: number;
  c: number;
  s: number;
  dx: number;
  dy: number;
}

const EPS = 1e-12;

export const getNodeMap = (project: ProjectModel): Map<string, NodeModel> =>
  new Map(project.nodes.map((node) => [node.id, node]));

export const frameEndTransfersRotation = (member: MemberModel, nodeId: string): boolean => {
  if (member.type !== 'frame') return false;
  const atI = member.i === nodeId;
  const atJ = member.j === nodeId;
  if (!atI && !atJ) return false;
  const explicitlyReleased = atI ? member.releases?.iMoment : member.releases?.jMoment;
  const connectionStiffness = atI ? member.rotationalSpringI : member.rotationalSpringJ;
  // Undefined is a rigid connection. A finite positive value is semi-rigid.
  // Zero is the documented release limit and must not activate the joint Rz DOF.
  return !explicitlyReleased && connectionStiffness !== 0;
};

const geometryOf = (member: MemberModel, nodes: Map<string, NodeModel>): Geometry => {
  const ni = nodes.get(member.i);
  const nj = nodes.get(member.j);
  if (!ni || !nj) throw new Error(`El miembro ${member.id} referencia nodos inexistentes.`);
  const dx = nj.x - ni.x;
  const dy = nj.y - ni.y;
  const L = Math.hypot(dx, dy);
  if (L <= EPS) throw new Error(`El miembro ${member.id} tiene longitud cero.`);
  return { L, c: dx / L, s: dy / L, dx, dy };
};

export const deformableGeometryOf = (member: MemberModel, nodes: Map<string, NodeModel>): {
  geometry: Geometry;
  grossLength: number;
  startOffset: number;
  endOffset: number;
} => {
  const gross = geometryOf(member, nodes);
  const startOffset = member.rigidOffsetI ?? 0;
  const endOffset = member.rigidOffsetJ ?? 0;
  const L = gross.L - startOffset - endOffset;
  if (!(L > EPS)) throw new Error(`Las zonas rígidas del miembro ${member.id} consumen toda su longitud.`);
  return {
    geometry: { ...gross, L },
    grossLength: gross.L,
    startOffset,
    endOffset,
  };
};

export type ConstraintKind = 'support' | 'bookkeeping' | 'rigid' | 'multi-point';
export interface ConstraintDefinition { row: number[]; kind: ConstraintKind; nodeId?: string; value: number }

/**
 * Restricciones homogéneas para los problemas propios. Conserva exactamente
 * qué GDL participan en el solver; los asientos no entran porque un modo no
 * tiene término independiente.
 */
export const assembleKinematicConstraints = (
  project: ProjectModel,
  nodes: Map<string, NodeModel>,
  nodeIndex: Map<string, number>,
  ndof: number,
): ConstraintDefinition[] => {
  const constraints: ConstraintDefinition[] = [];
  const add = (terms: Array<[number, number]>, kind: ConstraintKind, nodeId?: string) => {
    const row = Array(ndof).fill(0);
    terms.forEach(([index, coefficient]) => { row[index] += coefficient; });
    constraints.push({ row, kind, nodeId, value: 0 });
  };
  for (const node of project.nodes) {
    const base = nodeIndex.get(node.id)! * 3;
    if (node.support.type === 'fixed') { add([[base, 1]], 'support', node.id); add([[base + 1, 1]], 'support', node.id); add([[base + 2, 1]], 'support', node.id); }
    else if (node.support.type === 'pin') { add([[base, 1]], 'support', node.id); add([[base + 1, 1]], 'support', node.id); }
    else if (node.support.type === 'roller') {
      const angle = ((node.support.angleDeg ?? 90) * Math.PI) / 180;
      add([[base, Math.cos(angle)], [base + 1, Math.sin(angle)]], 'support', node.id);
    } else if (node.support.type === 'custom') {
      if (node.support.restrainX) add([[base, 1]], 'support', node.id);
      if (node.support.restrainY) add([[base + 1, 1]], 'support', node.id);
      if (node.support.restrainR) add([[base + 2, 1]], 'support', node.id);
    }
  }
  const participating = new Set(project.members.flatMap((member) => [member.i, member.j]));
  for (const node of project.nodes) {
    if (participating.has(node.id)) continue;
    const base = nodeIndex.get(node.id)! * 3;
    add([[base, 1]], 'bookkeeping', node.id); add([[base + 1, 1]], 'bookkeeping', node.id); add([[base + 2, 1]], 'bookkeeping', node.id);
  }
  for (const node of project.nodes) {
    const restrained = node.support.type === 'fixed' || (node.support.type === 'custom' && Boolean(node.support.restrainR));
    const spring = (node.support.spring?.kr ?? 0) > 0;
    const transfers = project.members.some((member) => {
      if (member.i !== node.id && member.j !== node.id) return false;
      if (member.type === 'rigid') return true;
      if (node.internalHinge) return false;
      return frameEndTransfersRotation(member, node.id);
    });
    if (!restrained && !spring && !transfers) add([[nodeIndex.get(node.id)! * 3 + 2, 1]], 'bookkeeping', node.id);
  }
  for (const member of project.members.filter((item) => item.type === 'rigid')) {
    const i = nodes.get(member.i)!; const j = nodes.get(member.j)!;
    const ii = nodeIndex.get(member.i)! * 3; const ji = nodeIndex.get(member.j)! * 3;
    add([[ji, 1], [ii, -1], [ii + 2, j.y - i.y]], 'rigid');
    add([[ji + 1, 1], [ii + 1, -1], [ii + 2, i.x - j.x]], 'rigid');
    add([[ji + 2, 1], [ii + 2, -1]], 'rigid');
  }
  for (const constraint of project.multiPointConstraints ?? []) {
    const terms: Array<[number, number]> = [];
    for (const term of constraint.terms) {
      const index = nodeIndex.get(term.nodeId);
      if (index === undefined) continue;
      const component = term.component === 'ux' ? 0 : term.component === 'uy' ? 1 : 2;
      terms.push([index * 3 + component, term.coefficient]);
    }
    if (terms.length) add(terms, 'multi-point');
  }
  return constraints;
};
