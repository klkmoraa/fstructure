import { memo } from 'react';
import type { StructureGenerationGhost } from '../../data/generators/generatorGhost';
import type { Point2D } from '../../data/structuralEditing';
import { circularMemberGeometry, curvedMemberPath } from '../../graphics/memberCurve';
import '../structure-generator/structureGenerator.css';
import './nativeCurves.css';
interface Props { ghost: StructureGenerationGhost; origin?: Point2D | null; toScreen: (x: number, y: number) => Point2D; label: string }
export const CanvasStructureGeneratorLayer = memo(({ ghost, origin, toScreen, label }: Props) => {
  const nodes = new Map(ghost.nodes.map(n => [n.key, n]));
  const originPoint = origin ? toScreen(origin.x, origin.y) : null;
  return <g className="structure-generation-ghost" data-structure-generation-ghost={ghost.kind}
    data-ghost-nodes={ghost.nodes.length} data-ghost-members={ghost.members.length}
    style={{ pointerEvents: 'none' }} role="img" aria-label={label}>
    <g className="structure-generation-ghost__members">{ghost.members.map(member => {
      const i = nodes.get(member.iKey), j = nodes.get(member.jKey);
      if (!i || !j) return null;
      const arc = circularMemberGeometry(member, i, j), a = toScreen(i.x, i.y), b = toScreen(j.x, j.y);
      return arc ? <path key={member.key} data-ghost-member-role={member.role} d={curvedMemberPath(arc, toScreen)} />
        : <line key={member.key} data-ghost-member-role={member.role} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
    })}</g>
    <g className="structure-generation-ghost__nodes">{ghost.nodes.map(node => {
      const p = toScreen(node.x, node.y);
      return <circle key={node.key} data-ghost-node-role={node.role} data-ghost-supported={node.supported} cx={p.x} cy={p.y} r="5" />;
    })}</g>
    {originPoint ? <g className="structure-generation-ghost__origin" data-ghost-origin="true"><circle cx={originPoint.x} cy={originPoint.y} r="9" />
      <path d={`M ${originPoint.x - 14} ${originPoint.y} H ${originPoint.x + 14} M ${originPoint.x} ${originPoint.y - 14} V ${originPoint.y + 14}`} /></g> : null}
  </g>;
});
