import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { analyzeProject } from './solver';
import type { MemberModel } from '../types';
import { trussMechanismIssues } from './trussMechanism';
import { buildModelDoctorReport } from '../features/model-doctor/modelDoctorDiagnostics';
import triangulatedExample from '../../public/examples/armadura-3-4-5.fusionstructure.json';
import { normalizeProject } from '../data/migrate';

/** Reconstruction of the supplied 3–4–5 geometry; m and kN internally. */
const photoModel = () => {
  const project = createBlankProject();
  project.nodes = [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 0, y: 4, support: { type: 'none' } },
    { id: 'N3', x: 3, y: 4, support: { type: 'none' } },
    { id: 'N4', x: 3, y: 3, support: { type: 'roller', angleDeg: 90 } },
    { id: 'N5', x: 1.5, y: 4, support: { type: 'none' } },
  ];
  project.members = [['N1', 'N2'], ['N2', 'N5'], ['N5', 'N3'], ['N1', 'N3'], ['N3', 'N4']]
    .map(([i, j], index): MemberModel => ({ id: `M${index + 1}`, i, j, type: 'truss', E: 200e6, A: 0.01, I: 0.0001 }));
  project.nodalLoads = [
    { id: 'P1', nodeId: 'N2', caseId: 'LC1', fx: 5 * 9.80665, fy: 0, mz: 0 },
    { id: 'P2', nodeId: 'N5', caseId: 'LC1', fx: 0, fy: -1.5 * 9.80665, mz: 0 },
  ];
  return project;
};

describe('photo truss mechanism regression', () => {
  it('imports and reopens the published example with seven axial members and balanced reactions', () => {
    const project = normalizeProject(triangulatedExample);
    const reopened = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(reopened).toEqual(project);
    expect(reopened.settings.units).toBe('t-m');
    expect(reopened.members).toHaveLength(7);
    expect(reopened.members.every(member => member.type === 'truss')).toBe(true);
    const result = analyzeProject(reopened);
    expect(result.success).toBe(true);
    expect(result.nodeResults.find(node => node.nodeId === 'N4')!.ry / 9.80665).toBeCloseTo(7.416666667, 6);
    expect(result.nodeResults.find(node => node.nodeId === 'N1')!.ry / 9.80665).toBeCloseTo(-5.916666667, 6);
  });
  it('retains the two physical mechanisms rather than fabricating a solution', () => {
    const result = analyzeProject(photoModel());
    expect(result.success).toBe(false);
    expect(result.mechanism?.nullity).toBe(2);
    expect(trussMechanismIssues(photoModel()).map(issue => issue.objectId).sort()).toEqual(['N4', 'N5']);
    expect(result.issues.filter(issue => issue.id.startsWith('truss-transverse-'))).toHaveLength(2);
  });

  it('resolves a triangulated alternative while preserving the original supports', () => {
    const project = photoModel();
    project.members.push({ ...project.members[0], id: 'M6', i: 'N1', j: 'N5' });
    project.members.push({ ...project.members[0], id: 'M7', i: 'N1', j: 'N4' });
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    expect(trussMechanismIssues(project)).toEqual([]);
    // Moment about N1: 3 Ry(N4) = 4(5g) + 1.5(1.5g).
    expect(result.nodeResults.find(node => node.nodeId === 'N4')!.ry).toBeCloseTo((20 + 2.25) * 9.80665 / 3, 6);
    expect(result.nodeResults.find(node => node.nodeId === 'N1')!.rx).toBeCloseTo(-5 * 9.80665, 6);
  });

  it('locates both free nodes in the model doctor before analyzing', () => {
    const findings = buildModelDoctorReport(photoModel()).findings.filter(finding => finding.sourceIssueId.startsWith('truss-transverse-'));
    expect(findings).toHaveLength(2);
    expect(findings.every(finding => finding.canLocate && finding.category === 'supports')).toBe(true);
  });

  it('accounts for inclined members and independent support directions', () => {
    const project = photoModel();
    project.nodes = project.nodes.map(node => ({ ...node, x: (node.x - node.y) / Math.SQRT2, y: (node.x + node.y) / Math.SQRT2 }));
    project.nodes[3].support = { type: 'roller', angleDeg: 135 };
    expect(trussMechanismIssues(project).map(issue => issue.objectId).sort()).toEqual(['N4', 'N5']);
    project.nodes[3].support = { type: 'roller', angleDeg: 45 };
    expect(trussMechanismIssues(project).map(issue => issue.objectId)).toEqual(['N5']);
  });

  it('recognizes transverse springs without mistaking axial springs for bracing', () => {
    const project = photoModel();
    project.nodes[4].support = { type: 'none', spring: { kx: 100 } };
    expect(trussMechanismIssues(project).some(issue => issue.objectId === 'N5')).toBe(true);
    project.nodes[4].support.spring = { kNormal: 100 };
    expect(trussMechanismIssues(project).some(issue => issue.objectId === 'N5')).toBe(false);
    project.nodes[3].support.spring = { kx: 100 };
    expect(trussMechanismIssues(project)).toEqual([]);
  });

  it('leaves coupled constraints and links to the global solver', () => {
    const project = photoModel();
    project.nodeLinks = [{ id: 'L1', nodeI: 'N5', behavior: 'linear', stiffness: 100, angleDeg: 90 }];
    project.multiPointConstraints = [{ id: 'C1', terms: [{ nodeId: 'N4', component: 'ux', coefficient: 1 }, { nodeId: 'N1', component: 'ux', coefficient: -1 }], value: 0 }];
    expect(trussMechanismIssues(project)).toEqual([]);
    const result = analyzeProject(project);
    expect(result.success, JSON.stringify(result.issues)).toBe(true);
  });

  it('resolves the same geometry with continuous bending members', () => {
    const project = photoModel();
    project.members.forEach(member => { member.type = 'frame'; });
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    expect(result.nodeResults.find(node => node.nodeId === 'N4')!.ry).toBeCloseTo((20 + 2.25) * 9.80665 / 3, 6);
  });
});
