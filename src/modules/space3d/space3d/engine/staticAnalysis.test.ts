import { describe, expect, it } from 'vitest';

import { axialCantilever } from './fixtures';
import { assembleSpace3DStaticModel, analyzeSpace3DStatic } from './solver';
import { handleSpace3DWorkerRequest, SPACE3D_PROTOCOL_VERSION } from '../runtime/protocol';

describe('Space3D canonical static assembly', () => {
  it('assembles a six-DOF map, stiffness and target load before solving', () => {
    const project = axialCantilever({ P: 10 });
    const assembly = assembleSpace3DStaticModel(project, 'CO1');

    expect(assembly.totalDofs).toBe(12);
    expect(assembly.stiffness).toHaveLength(12);
    expect(assembly.stiffness.every((row) => row.length === 12)).toBe(true);
    expect(assembly.nodeDofIndices.get('I')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(assembly.nodeDofIndices.get('J')).toEqual([6, 7, 8, 9, 10, 11]);
    expect(assembly.loadVector[6]).toBe(10);
    expect(assembly.freeDofs).toHaveLength(6);
    expect(assembly.restrainedDofs).toHaveLength(6);
  });

  it('solves through the canonical assembly with the six-DOF planar result', () => {
    const result = analyzeSpace3DStatic(axialCantilever({ P: 10 }), 'CO1');

    expect(result.success).toBe(true);
    expect(result.nodeResults.find((node) => node.nodeId === 'J')?.displacement).toMatchObject({
      ux: 1e-5,
      uy: 0,
      uz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
    });
    expect(result.diagnostics.equilibrium.normalized).toBeLessThanOrEqual(1e-8);
  });

  it('rejects before dense matrix allocation when the memory budget is exhausted', () => {
    const project = axialCantilever({ P: 10 });
    const assembly = assembleSpace3DStaticModel(project, 'CO1', {
      budget: { maxEstimatedBytes: 1, softDeadlineMs: 30_000 },
    });

    expect(assembly.valid).toBe(false);
    expect(assembly.issues).toContainEqual({ code: 'memory-budget', entityKind: 'project', entityId: project.id, field: 'budget' });
    expect(assembly.stiffness).toEqual([]);
    expect(assembly.loadVector).toEqual([]);
  });

  it('propagates the memory admission through the linear worker entry', () => {
    const response = handleSpace3DWorkerRequest({
      protocolVersion: SPACE3D_PROTOCOL_VERSION,
      type: 'run',
      requestId: 1,
      project: axialCantilever({ P: 10 }),
      targetId: 'CO1',
      budget: { maxEstimatedBytes: 1, softDeadlineMs: 30_000 },
    });

    expect(response).toMatchObject({
      type: 'success',
      result: {
        success: false,
        issues: [expect.objectContaining({ code: 'memory-budget' })],
        nodeResults: [],
        memberResults: [],
      },
    });
  });

  it('fails closed when a persisted semantic has no static implementation yet', () => {
    const project = axialCantilever({ P: 10 });
    const withRelease = {
      ...project,
      members: [{ ...project.members[0], releases: { jRz: true } }],
    };

    const result = analyzeSpace3DStatic(withRelease, 'CO1');

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual({
      code: 'unsupported-semantics',
      entityKind: 'member',
      entityId: 'M1',
      field: 'releases',
    });
  });
});
