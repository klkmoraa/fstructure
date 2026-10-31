import { describe, expect, it } from 'vitest';
import { circularMemberGeometry, curvePointAt, curvedMemberPath, curveRatioAtPoint, memberCurveLength, straightenImpossibleCurves } from './memberCurve';
import { generateStructure } from '../data/generators/structureGenerators';
import { createBlankProject, CURRENT_SCHEMA_VERSION } from '../data/defaultProject';
import { normalizeProject } from '../data/migrate';
import { applyProjectPatch, compileProjectCommand } from '../commands/projectCommand';
import { structureBounds } from './structureGeometry';
import { classifyStructure } from '../analysis-methods/structureClassification';
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
  it('drops the curve when the member stops being a frame, so the project still saves', () => {
    const p = createBlankProject(), shape = arch();
    p.nodes = structuredClone([...shape.nodes]); p.members = structuredClone([...shape.members]);
    const cmd = compileProjectCommand(p, { kind: 'member.update', description: 'Armadura', memberId: 'M1', changes: { type: 'truss' } });
    const truss = applyProjectPatch(p, cmd.forward);
    expect(truss.members[0].curve).toBeUndefined();
    expect(() => normalizeProject(JSON.parse(JSON.stringify(truss)))).not.toThrow();
    expect(applyProjectPatch(truss, cmd.inverse)).toEqual(p);
  });
  it('straightens a curve whose end nodes coincide or that is no longer a frame', () => {
    const p = createBlankProject(), shape = arch();
    p.nodes = structuredClone([...shape.nodes]); p.members = structuredClone([...shape.members]);
    expect(straightenImpossibleCurves(p)).toBe(p);
    const collapsed = structuredClone(p); collapsed.nodes[1].x = collapsed.nodes[0].x; collapsed.nodes[1].y = collapsed.nodes[0].y;
    expect(straightenImpossibleCurves(collapsed).members[0].curve).toBeUndefined();
    const rigid = structuredClone(p); rigid.members[0].type = 'truss';
    const fixed = straightenImpossibleCurves(rigid);
    expect(fixed.members[0].curve).toBeUndefined();
    expect(rigid.members[0].curve).toBeDefined();
    expect(() => normalizeProject(JSON.parse(JSON.stringify(fixed)))).not.toThrow();
  });
  it('does not classify an arch between aligned supports as a straight beam', () => {
    const p = createBlankProject(), shape = arch();
    p.nodes = structuredClone([...shape.nodes]); p.members = structuredClone([...shape.members]);
    p.nodes[0].support = { type: 'pin' }; p.nodes[1].support = { type: 'roller', angleDeg: 90 };
    expect(classifyStructure(p).kind).toBe('frame');
    delete p.members[0].curve;
    expect(classifyStructure(p).kind).toBe('simple-beam');
  });
});
