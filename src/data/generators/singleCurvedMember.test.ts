import { describe, expect, it } from 'vitest';
import { generateStructure } from './structureGenerators';
import { createBlankProject } from '../defaultProject';
import { analyzeProject } from '../../engine/solver';

const properties = { kind: 'explicit' as const, E: 200_000_000, A: 0.02, I: 0.0001 };

describe('single curved member, not a chain of drafting nodes', () => {
  it.each([12, 24, 200])('creates only two end nodes and one circular member (%i legacy divisions)', (segments) => {
    const shape = generateStructure({ kind: 'circular-arch', span: 10, rise: 3, segments, properties });
    expect(shape.nodes).toHaveLength(2);
    expect(shape.members).toHaveLength(1);
    expect(shape.members[0]).toMatchObject({ i: shape.nodes[0].id, j: shape.nodes[1].id, curve: { kind: 'circular-arc', bulge: 0.6 } });
    expect(shape.summary.nodeCount).toBe(2);
    expect(shape.summary.memberCount).toBe(1);
  });

  it('keeps only physical end nodes and one member in the analysis result', () => {
    const shape = generateStructure({ kind: 'circular-arch', span: 2, rise: 1, segments: 24, properties });
    const project = createBlankProject();
    project.nodes = structuredClone([...shape.nodes]);
    project.members = structuredClone([...shape.members]);
    project.nodes[0].support = { type: 'fixed' };
    project.loadCases.forEach(c => { c.selfWeightFactor = 0; });
    project.nodalLoads = [{ id: 'P', nodeId: project.nodes.at(-1)!.id, caseId: project.loadCases[0].id, fx: 0, fy: -1, mz: 0 }];
    const snapshot = JSON.stringify(project);
    const result = analyzeProject(project, null, { includeEducationTrace: false });
    expect(result.success).toBe(true);
    expect(result.nodeResults).toHaveLength(2);
    expect(result.memberResults).toHaveLength(1);
    expect(JSON.stringify(project)).toBe(snapshot);
    // Castigliano: semicircular, extensible Euler-Bernoulli cantilever,
    // unit vertical end force, radius 1. This checks bending, not just drawing.
    const expectedUy = -(3 * Math.PI / (2 * properties.E * properties.I) + Math.PI / (2 * properties.E * properties.A));
    const tip = result.nodeResults.find(n => n.nodeId === project.nodes.at(-1)!.id)!;
    expect(Math.abs((tip.uy - expectedUy) / expectedUy)).toBeLessThan(0.002);
  });
});
