import { solveLinearSystem, zeros } from '../foundation/linearAlgebra';
import type { AnalysisResult, ProjectModel } from '../types';

/**
 * Solve joint equilibrium A q = -P independently of stiffness. A full-column-
 * rank A can have unique forces even when its transpose has a kinematic null
 * space. This does NOT determine displacements or establish stability.
 * Only bilateral, pin-jointed trusses with nodal forces and hard supports are
 * covered. Never regularize a mechanism or invent a restraint/reaction.
 */
export const solveTrussEquilibrium = (
  project: ProjectModel,
  factors: Record<string, number>,
): AnalysisResult['trussEquilibrium'] => {
  if (!project.members.length || project.members.some(member => member.type !== 'truss'
    || (member.axialBehavior && member.axialBehavior !== 'both')
    || Object.values(member.releases ?? {}).some(Boolean))
    || project.memberLoads.length || project.memberInitialEffects?.length
    || project.nodeLinks?.length || project.multiPointConstraints?.length
    || project.prescribedDisplacements?.length
    || project.nodes.some(node => Object.values(node.support.spring ?? {}).some(value => value !== undefined && value !== 0)
      || Object.values(node.support.prescribed ?? {}).some(value => value !== undefined && value !== 0))
    || project.loadCases.some(loadCase => (factors[loadCase.id] ?? 0) !== 0 && (loadCase.selfWeightFactor ?? 0) !== 0)) return;
  const indices = new Map(project.nodes.map((node, index) => [node.id, index * 2]));
  const columns: number[][] = [];
  const size = project.nodes.length * 2;
  for (const member of project.members) {
    const i = indices.get(member.i);
    const j = indices.get(member.j);
    if (i === undefined || j === undefined) return;
    const ni = project.nodes[i / 2];
    const nj = project.nodes[j / 2];
    const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
    if (!Number.isFinite(length) || length <= 0) return;
    const c = (nj.x - ni.x) / length;
    const s = (nj.y - ni.y) / length;
    const column = Array<number>(size).fill(0);
    column[i] = c; column[i + 1] = s;
    column[j] = -c; column[j + 1] = -s;
    columns.push(column);
  }
  const supports: Array<{ nodeId: string; x: number; y: number; column: number }> = [];
  const support = (nodeId: string, x: number, y: number) => {
    const column = Array<number>(size).fill(0);
    const index = indices.get(nodeId)!;
    column[index] = x; column[index + 1] = y;
    supports.push({ nodeId, x, y, column: columns.length });
    columns.push(column);
  };
  for (const node of project.nodes) {
    const type = node.support.type;
    if (type === 'pin' || type === 'fixed' || (type === 'custom' && node.support.restrainX)) support(node.id, 1, 0);
    if (type === 'pin' || type === 'fixed' || (type === 'custom' && node.support.restrainY)) support(node.id, 0, 1);
    if (type === 'roller') {
      const angle = (node.support.angleDeg ?? 90) * Math.PI / 180;
      support(node.id, Math.cos(angle), Math.sin(angle));
    }
  }
  // More unknowns than equations cannot give unique forces from statics alone.
  if (columns.length > size) return;
  const rhs = Array<number>(size).fill(0);
  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0) continue;
    const index = indices.get(load.nodeId);
    if (index === undefined || load.mz !== 0) return;
    rhs[index] -= factor * load.fx;
    rhs[index + 1] -= factor * load.fy;
  }
  if (!rhs.every(Number.isFinite)) return;
  const scale = Math.max(...rhs.map(Math.abs)) || 1;
  // [ I A ; Aᵀ 0 ] solves least squares without squaring the condition number.
  // Reject any nonzero residual: incompatible loads have NO equilibrium solution.
  const matrix = zeros(size + columns.length, size + columns.length);
  for (let row = 0; row < size; row += 1) {
    matrix[row][row] = 1;
    columns.forEach((column, index) => {
      matrix[row][size + index] = column[row];
      matrix[size + index][row] = column[row];
    });
  }
  try {
    const solution = solveLinearSystem(matrix, [...rhs.map(value => value / scale), ...columns.map(() => 0)]);
    if (solution.conditionEstimate > 1e10 || !solution.x.every(Number.isFinite)) return;
    const q = solution.x.slice(size);
    const normalizedResidual = Math.max(...rhs.map((value, row) => Math.abs(columns.reduce((sum, column, col) => sum + column[row] * q[col], 0) - value / scale)));
    if (normalizedResidual > 1e-10) return;
    const reactions = project.nodes.filter(node => supports.some(item => item.nodeId === node.id))
      .map(node => ({ nodeId: node.id, rx: 0, ry: 0 }));
    supports.forEach(item => {
      const reaction = reactions.find(node => node.nodeId === item.nodeId)!;
      reaction.rx += item.x * q[item.column] * scale;
      reaction.ry += item.y * q[item.column] * scale;
    });
    return {
      memberForces: project.members.map((member, index) => ({ memberId: member.id, axial: q[index] * scale })),
      reactions,
      normalizedResidual,
    };
  } catch {
    // Rank deficient: no unique set of member forces. Keep the original failure.
    return;
  }
};
