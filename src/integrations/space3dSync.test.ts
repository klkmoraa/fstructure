import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { linkSpace3DToShell } from '../features/workspace/adapters/space3dShellBridge';
import { buildPlanar2DToSpace3DHandoff } from './planar2dToSpace3d';
import { applyApprovedSpace3DSync, prepareSpace3DSyncReview, SPACE3D_SYNC_ADMISSION } from './space3dSync';

describe('revisión 3D → 2D', () => {
  it('agrupa cambios exactos, de revisión, fuera del plano y conflictos por campo', () => {
    const source = { ...createDefaultProject(), id: 'sync-source' };
    const current = {
      ...source,
      nodes: source.nodes.map((node) => node.id === 'N1' ? { ...node, x: 1 } : node),
    };
    const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
    const edited = {
      ...candidate,
      nodes: [...candidate.nodes.map((node) => node.id === 'N1'
        ? { ...node, x: 2 }
        : node.id === 'N2'
          ? { ...node, y: 3 }
          : node.id === 'N3'
            ? { ...node, z: 4 }
            : node), {
        id: 'N-NEW', x: 10, y: 0, z: 0,
        restraints: { ux: false, uy: false, uz: false, rx: true, ry: true, rz: false },
      }],
      members: [...candidate.members.map((member) => member.id === 'M3' ? { ...member, type: 'truss' as const } : member), {
        ...candidate.members[0], id: 'M-NEW', i: 'N2', j: 'N-NEW',
        orientation: { ...candidate.members[0].orientation, rollRadians: 0.2 },
        releases: { iUz: true },
      }],
      nodalLoads: [...candidate.nodalLoads.map((load) => load.id === 'NL1' ? { ...load, fz: 9 } : load), {
        id: 'NL-NEW', caseId: candidate.loadCases[0].id, nodeId: 'N-NEW', fx: 0, fy: 0, fz: 5, mx: 0, my: 2, mz: 0,
      }],
    };

    const review = prepareSpace3DSyncReview(source, current, edited);
    const pick = (kind: string, id: string, field: string) => review.patches.find((patch) => patch.entityKind === kind && patch.entityId === id && patch.field === field);

    expect(pick('node', 'N1', 'x')).toMatchObject({ before: 0, after: 2, compatibility: 'exact', state: 'conflict' });
    expect(pick('node', 'N2', 'y')).toMatchObject({ before: 0, after: 3, compatibility: 'exact', state: 'ready' });
    expect(pick('node', 'N3', 'z')).toMatchObject({ before: 0, after: 4, compatibility: 'unsupported', state: 'unsupported' });
    expect(pick('member', 'M3', 'type')).toMatchObject({ before: 'frame', after: 'truss', compatibility: 'requires-review', state: 'ready' });
    expect(pick('nodal-load', 'NL1', 'fz')).toMatchObject({ before: 0, after: 9, compatibility: 'unsupported', state: 'unsupported' });
    expect(pick('node', 'N-NEW', 'restraints.uz')).toMatchObject({ compatibility: 'unsupported', state: 'unsupported' });
    expect(pick('member', 'M-NEW', 'orientation')).toMatchObject({ compatibility: 'unsupported', state: 'unsupported' });
    expect(pick('member', 'M-NEW', 'releases.iUz')).toMatchObject({ compatibility: 'unsupported', state: 'unsupported' });
    expect(pick('nodal-load', 'NL-NEW', 'fz')).toMatchObject({ compatibility: 'unsupported', state: 'unsupported' });

    const approved = review.patches.filter((patch) => patch.entityId === 'N2').map((patch) => patch.patchId);
    const applied = applyApprovedSpace3DSync(current, review, approved);
    expect(applied.nodes.find((node) => node.id === 'N2')?.y).toBe(3);
    expect(applied.nodes.find((node) => node.id === 'N3')).toMatchObject({ x: 0, y: 4 });

    expect(() => applyApprovedSpace3DSync(current, review, [pick('node', 'N3', 'z')!.patchId])).toThrow(/unsupported|no compatible/i);
    const exact = pick('node', 'N2', 'y')!;
    const tampered = {
      ...review,
      patches: review.patches.map((patch) => patch.patchId === exact.patchId ? { ...patch, after: 300 } : patch),
    };
    expect(() => applyApprovedSpace3DSync(current, tampered, [exact.patchId])).toThrow(/sello|seal|alterada/i);
    const prototypePatch = Object.assign(Object.create({ injected: true }), exact);
    expect(() => applyApprovedSpace3DSync(current, { ...review, patches: [prototypePatch] }, [exact.patchId])).toThrow(/objeto plano|prototype|alterada/i);
    expect(SPACE3D_SYNC_ADMISSION).toEqual({ maxEntityCount: null, strategy: 'runtime-budget' });
  });

  it('marca como unsupported toda semántica nueva que referencia geometría fuera del plano', () => {
    const source = { ...createDefaultProject(), id: 'sync-semantic-additions' };
    const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
    const outNode = {
      id: 'N-3D', x: 2, y: 0, z: 4,
      restraints: { ux: false, uy: false, uz: true, rx: true, ry: true, rz: false },
    } as const;
    const outMember = { ...candidate.members[0], id: 'M-3D', i: outNode.id, j: candidate.members[0].j };
    const outCase = candidate.loadCases[0].id;
    const edited = {
      ...candidate,
      nodes: [...candidate.nodes, outNode],
      members: [...candidate.members, outMember],
      prescribedDisplacements: [{ id: 'PD-3D', nodeId: outNode.id, caseId: outCase, component: 'ux' as const, value: 1 }],
      memberLoads: [{ id: 'ML-3D', memberId: outMember.id, caseId: outCase, type: 'distributed' as const, coordinateSystem: 'global' as const, lengthBasis: 'real' as const, start: 0, end: 1, qyStart: 1, qyEnd: 1 }],
      memberInitialEffects: [{ id: 'IE-3D', memberId: outMember.id, caseId: outCase, type: 'temperature' as const, alpha: 1, deltaT: 1 }],
      nodeLinks: [{ id: 'LINK-3D', nodeI: outNode.id, behavior: 'linear' as const, direction: [1, 0, 0] as const, stiffness: 1 }],
      multiPointConstraints: [{ id: 'MPC-3D', terms: [{ nodeId: outNode.id, component: 'ux' as const, coefficient: 1 }, { nodeId: candidate.nodes[0].id, component: 'ux' as const, coefficient: -1 }] }],
      nodalMasses: [{ id: 'MASS-3D', nodeId: outNode.id, mass: 1 }],
      generatedLoadSources: [{ id: 'GEN-3D', kind: 'tributary-surface' as const, caseId: outCase, memberIds: [outMember.id], pressure: 1, tributaryWidth: 1, direction: 'global-y' as const }],
      movingLoadCases: [{ id: 'MOV-3D', name: '3D', memberIds: [outMember.id], targetMemberId: outMember.id, targetPosition: 0.5, quantity: 'N' as const, startNodeId: outNode.id, axles: [{ P: 1, offset: 0 }] }],
    };

    const review = prepareSpace3DSyncReview(source, source, edited);
    for (const [entityKind, entityId] of [
      ['prescribed-displacement', 'PD-3D'], ['member-load', 'ML-3D'], ['initial-effect', 'IE-3D'],
      ['node-link', 'LINK-3D'], ['multi-point-constraint', 'MPC-3D'], ['nodal-mass', 'MASS-3D'],
      ['generated-load-source', 'GEN-3D'], ['moving-load-case', 'MOV-3D'],
    ] as const) {
      expect(review.patches.some((patch) => patch.entityKind === entityKind && patch.entityId === entityId && patch.field === '$entity' && patch.compatibility === 'unsupported')).toBe(true);
    }
  });

  it('valida el modelo editado antes de preparar una revisión directa', () => {
    const source = { ...createDefaultProject(), id: 'sync-invalid-edited' };
    const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
    expect(() => prepareSpace3DSyncReview(source, source, {
      ...candidate,
      prescribedDisplacements: [{ id: 'PD', nodeId: 'MISSING', caseId: candidate.loadCases[0].id, component: 'ux', value: 0 }],
    })).toThrow(/missing-reference/i);
  });

  it('exige una revisión local inmutable y valida identidad, ciclos y linaje antes de aplicar', () => {
    const source = { ...createDefaultProject(), id: 'sync-review-boundary' };
    const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
    const edited = { ...candidate, nodes: candidate.nodes.map((node) => node.id === 'N2' ? { ...node, y: 2 } : node) };
    const review = prepareSpace3DSyncReview(source, source, edited);
    const approved = review.patches.filter((patch) => patch.entityId === 'N2').map((patch) => patch.patchId);

    const reloaded = JSON.parse(JSON.stringify(review)) as typeof review;
    expect(() => applyApprovedSpace3DSync(source, reloaded, approved)).toThrow(/local|capacidad|regener|prepar/i);

    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    const cyclic = { ...review, patches: review.patches.map((patch) => patch.patchId === approved[0] ? { ...patch, before: cycle } : patch) };
    expect(() => applyApprovedSpace3DSync(source, cyclic, approved)).toThrow(/cíclic|cyclic|cycle|review|revisión/i);

    const addition = { ...candidate, nodes: [...candidate.nodes, {
      id: 'N-NEW', x: 10, y: 0, z: 0,
      restraints: { ux: false, uy: false, uz: false, rx: true, ry: true, rz: false },
    }] };
    const additionReview = prepareSpace3DSyncReview(source, source, addition);
    const entityPatch = additionReview.patches.find((patch) => patch.entityId === 'N-NEW' && patch.field === '$entity');
    expect(entityPatch).toBeDefined();
    const mismatchedIdentity = {
      ...additionReview,
      patches: additionReview.patches.map((patch) => patch.patchId === entityPatch?.patchId
        ? { ...patch, entityId: 'OTHER', after: { ...(patch.after as object), id: 'OTHER' } }
        : patch),
    };
    expect(() => applyApprovedSpace3DSync(source, mismatchedIdentity, [entityPatch!.patchId])).toThrow(/revisión|patch|ID|identidad/i);

    const linked = linkSpace3DToShell(source, 'source-v1', candidate);
    expect(() => prepareSpace3DSyncReview({ ...linked, sourceProjectId: 'other-project' }, source)).toThrow(/linaje|pertenece|source|proyecto/i);
    expect(() => prepareSpace3DSyncReview({ ...linked, sourceVersion: '' }, source)).toThrow(/versión|version|source/i);
  });
});
