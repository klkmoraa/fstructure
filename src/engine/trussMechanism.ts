import type { ProjectModel, ValidationIssue } from '../types';

/** Local translational mechanisms only. The global solver still determines stability. */
export const trussMechanismIssues = (project: ProjectModel): ValidationIssue[] => {
  const nodes = new Map(project.nodes.map(node => [node.id, node]));
  return project.nodes.flatMap((node): ValidationIssue[] => {
    const members = project.members.filter(member => member.i === node.id || member.j === node.id);
    if (!members.length || members.some(member => member.type !== 'truss')) return [];
    // Coupled constraints and links require the assembled system; do not infer
    // their effective stiffness from local topology (including unilateral links).
    if (project.nodeLinks?.some(link => link.nodeI === node.id || link.nodeJ === node.id)
      || project.multiPointConstraints?.some(constraint => constraint.terms.some(term => term.nodeId === node.id))) return [];
    const directions: [number, number][] = [];
    for (const member of members) {
      const other = nodes.get(member.i === node.id ? member.j : member.i);
      if (!other) return [];
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length <= 0) return [];
      directions.push([dx / length, dy / length]);
    }
    const support = node.support;
    if (support.type === 'pin' || support.type === 'fixed') return [];
    const angle = (degrees: number): [number, number] => [Math.cos(degrees * Math.PI / 180), Math.sin(degrees * Math.PI / 180)];
    if (support.type === 'roller') directions.push(angle(support.angleDeg ?? 90));
    if ((support.type === 'custom' && support.restrainX) || (support.spring?.kx ?? 0) > 0) directions.push([1, 0]);
    if ((support.type === 'custom' && support.restrainY) || (support.spring?.ky ?? 0) > 0) directions.push([0, 1]);
    if ((support.spring?.kNormal ?? 0) > 0) directions.push(angle(support.spring?.angleDeg ?? 90));
    const [x, y] = directions[0];
    if (directions.some(([dx, dy]) => !Number.isFinite(dx + dy) || Math.abs(x * dy - y * dx) > 1e-10)) return [];
    const motion = Math.abs(y) < 1e-10 ? 'vertical' : Math.abs(x) < 1e-10 ? 'horizontal' : 'perpendicular a las barras';
    return [{
      id: `truss-transverse-mechanism-${node.id}`,
      severity: 'warning',
      objectId: node.id,
      objectKind: 'node',
      title: `${node.id}: movimiento ${motion} sin rigidez`,
      message: `Las barras de armadura conectadas a ${node.id} sólo aportan rigidez axial. El movimiento ${motion} queda libre con los apoyos actuales.`,
      suggestedFix: 'Si debe ser una armadura, triangula el nodo o revisa sus restricciones reales. Si la pieza debe resistir una carga transversal por flexión, usa miembros de pórtico con E e I y continuidad adecuados. Dividir una barra y añadir una carga nodal no la estabiliza.',
    }];
  });
};
