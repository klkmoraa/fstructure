import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { generateStructure } from '../data/generators/structureGenerators';
import { analyzeProject } from './solver';
import { normalizeProject } from '../data/migrate';
import { space3dFromModel2d } from '../integrations/model2dSpace3d';
import { model2dDesignSource } from '../design/elements/model2dSource';

const cantilever = () => {
  const p = createBlankProject();
  const shape = generateStructure({ kind: 'circular-arch', span: 2, rise: 1, segments: 24,
    properties: { kind: 'explicit', E: 200e6, A: 0.02, I: 0.0001 } });
  p.nodes = structuredClone([...shape.nodes]); p.members = structuredClone([...shape.members]);
  p.nodes[0].support = { type: 'fixed' }; return p;
};

describe('loads on one native curved member', () => {
  it('equilibrates a point load at the crown without exposing internal nodes', () => {
    const p = cantilever();
    p.memberLoads = [{ id: 'P', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -3 }];
    const before = JSON.stringify(p), r = analyzeProject(p, null, { includeEducationTrace: false });
    expect(r.success).toBe(true); expect(r.nodeResults).toHaveLength(2); expect(r.memberResults).toHaveLength(1);
    const support = r.nodeResults.find(n => n.nodeId === 'N1')!;
    expect(support.ry).toBeCloseTo(3, 7); expect(support.rm).toBeCloseTo(3, 7);
    expect(JSON.stringify(p)).toBe(before);
    expect(normalizeProject(JSON.parse(before)).members[0].curve).toEqual(p.members[0].curve);
  });
  it('integrates real arc length, not its chord, for distributed loads', () => {
    const p = cantilever();
    p.memberLoads = [{ id: 'Q', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -2, qyEnd: -2 }];
    const r = analyzeProject(p, null, { includeEducationTrace: false });
    expect(r.success).toBe(true);
    const support = r.nodeResults.find(n => n.nodeId === 'N1')!;
    expect(support.ry).toBeCloseTo(2 * Math.PI, 6); expect(support.rm).toBeCloseTo(2 * Math.PI, 6);
  });
  it('uses exact arc length for self-weight once', () => {
    const p = cantilever(); p.members[0].density = 7850; p.loadCases[0].selfWeightFactor = 1;
    const r = analyzeProject(p, null, { includeEducationTrace: false });
    expect(r.success).toBe(true);
    const expected = 7850 * 0.02 * 9.80665 / 1000 * Math.PI;
    expect(r.nodeResults.find(n => n.nodeId === 'N1')!.ry).toBeCloseTo(expected, 6);
  });
  it('rejects unverified nonlinear analysis rather than analyzing a straight chord', () => {
    const p = cantilever();
    const r = analyzeProject(p, null, { pDeltaAxialForces: new Map([['M1', -20]]) });
    expect(r.success).toBe(false); expect(r.issues.some(i => i.id === 'curved-analysis')).toBe(true);
  });
  it('does not flatten curves on transfer or certify them with straight concrete checks', () => {
    const p = cantilever(), before = JSON.stringify(p);
    expect(space3dFromModel2d(p, { frames: 2, spacingM: 3 }).model).toBeNull();
    const source = model2dDesignSource(p);
    expect(source.errors.some(e => e.includes('curvas'))).toBe(true);
    expect(source.create({ braced: true })).toBeNull();
    expect(JSON.stringify(p)).toBe(before);
  });
});
