import { describe, expect, it } from 'vitest';
import { createBlankProject } from './defaultProject';
import { generateStructure } from './generators/structureGenerators';
import { ensureNodeAtPoint, memberInteriorRatioAtPoint, repairProjectTopology, splitMemberAt } from './modelOperations';
import { circularMemberGeometry } from '../graphics/memberCurve';
const create = () => {
  const p = createBlankProject(), g = generateStructure({ kind: 'circular-arch', span: 2, rise: 1, segments: 200, properties: { kind: 'explicit', E: 200e6, A: 0.02, I: 0.0001 } });
  p.nodes = structuredClone([...g.nodes]); p.members = structuredClone([...g.members]); return p;
};
describe('native curve topology', () => {
  it('does not split the arc when placing a node on its imaginary chord', () => {
    const p = create();
    expect(memberInteriorRatioAtPoint(p, p.members[0], { x: 1, y: 0 })).toBeNull();
    ensureNodeAtPoint(p, { x: 1, y: 0 });
    expect(p.members).toHaveLength(1); expect(p.nodes).toHaveLength(3);
    p.nodes[2].support = { type: 'fixed' };
    expect(repairProjectTopology(p).splitMembers).toHaveLength(0);
  });
  it('introduces one physical joint only when the user explicitly splits the curve', () => {
    const p = create();
    const result = splitMemberAt(p, 'M1', 0.5), node = p.nodes.find(n => n.id === result.nodeId)!;
    expect(node.x).toBeCloseTo(1, 12); expect(node.y).toBeCloseTo(1, 12);
    expect(p.nodes).toHaveLength(3); expect(p.members).toHaveLength(2);
    const nodes = new Map(p.nodes.map(n => [n.id, n]));
    const length = p.members.reduce((sum, m) => sum + circularMemberGeometry(m, nodes.get(m.i)!, nodes.get(m.j)!)!.length, 0);
    expect(length).toBeCloseTo(Math.PI, 12);
    expect(p.members.every(m => Math.abs(m.curve!.bulge - Math.tan(Math.PI / 8)) < 1e-12)).toBe(true);
  });
  it('connects an explicitly placed crown node to the curved member', () => {
    const p = create(), result = ensureNodeAtPoint(p, { x: 1, y: 1 });
    expect(result.created).toBe(true); expect(p.nodes).toHaveLength(3); expect(p.members).toHaveLength(2);
    expect(p.members[0].j).toBe(result.nodeId); expect(p.members[1].i).toBe(result.nodeId);
  });
});
