import { describe, expect, it } from 'vitest';
import { circularMemberGeometry, curvePointAt, curvedMemberPath, curveRatioAtPoint, memberCurveLength } from './memberCurve';
import { generateStructure } from '../data/generators/structureGenerators';
import { createBlankProject, CURRENT_SCHEMA_VERSION } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { applyProjectPatch, compileProjectCommand } from '../commands/projectCommand';
import { structureBounds } from './structureGeometry';
const properties = { kind: 'explicit' as const, E: 200e6, A: 0.02, I: 0.0001 };
const arch = () => generateStructure({ kind: 'circular-arch', span: 10, rise: 5, segments: 200, properties });
describe('native circular member geometry', () => {
  it('has an exact semicircular path, analytic length and crown, not drafting segments', () => {
    const { nodes, members } = arch(), a = circularMemberGeometry(members[0], nodes[0], nodes[1])!;
    expect(curvePointAt(a, 0.5).x).toBeCloseTo(5, 12); expect(curvePointAt(a, 0.5).y).toBeCloseTo(5, 12);
    expect(memberCurveLength(members[0], nodes[0], nodes[1])).toBeCloseTo(5 * Math.PI, 12);
    expect(curvedMemberPath(a, (x, y) => ({ x: x * 20, y: -y * 20 }))).toContain(' A ');
    expect(structureBounds(nodes, members).maxY).toBeCloseTo(5, 12);
    expect(curveRatioAtPoint(a, { x: 5, y: 5 })).toBeCloseTo(0.5, 12);
  });
  it('rotates with arbitrary endpoint coordinates and supports opposite curvature', () => {
    const member = arch().members[0];
    const a = circularMemberGeometry(member, { x: 2, y: 3 }, { x: 2, y: 13 })!;
    expect(curvePointAt(a, 0.5).x).toBeCloseTo(-3, 12);
    expect(curvePointAt(a, 0.5).y).toBeCloseTo(8, 12);
    const b = circularMemberGeometry({ curve: { kind: 'circular-arc', bulge: -1 } }, { x: 2, y: 3 }, { x: 2, y: 13 })!;
    expect(curvePointAt(b, 0.5).x).toBeCloseTo(7, 12);
  });
  it('preserves curved identity through normalization and protects future readers', () => {
    const p = createBlankProject(), shape = arch();
    p.nodes = structuredClone([...shape.nodes]); p.members = structuredClone([...shape.members]);
    const restored = normalizeProject(JSON.parse(JSON.stringify(p)));
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(10);
    expect(restored.members[0].curve).toEqual(p.members[0].curve);
    expect(restored.nodes).toHaveLength(2); expect(restored.members).toHaveLength(1);
    const invalid = structuredClone(p); invalid.members[0].curve!.bulge = 4;
    expect(() => normalizeProject(invalid)).toThrow();
  });
  it('curves an existing member without changing nodes or loads and can undo it', () => {
    const p = createBlankProject(), shape = arch();
    p.nodes = structuredClone([...shape.nodes]); p.members = structuredClone([...shape.members]);
    delete p.members[0].curve;
    p.memberLoads = [{ id: 'P', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -2 }];
    const cmd = compileProjectCommand(p, { kind: 'member.update', description: 'Curvar barra', memberId: 'M1', changes: { curve: { kind: 'circular-arc', bulge: 0.5 } } });
    const changed = applyProjectPatch(p, cmd.forward);
    expect(changed.nodes).toEqual(p.nodes); expect(changed.memberLoads).toEqual(p.memberLoads);
    expect(changed.members).toHaveLength(1); expect(changed.members[0].curve?.bulge).toBe(0.5);
    expect(applyProjectPatch(changed, cmd.inverse)).toEqual(p);
  });
});
