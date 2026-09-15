import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { buildPlanar2DToSpace3DHandoff } from './planar2dToSpace3d';
import { applyApprovedSpace3DSync, prepareSpace3DSyncReview } from './space3dSync';

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
      nodes: candidate.nodes.map((node) => node.id === 'N1'
        ? { ...node, x: 2 }
        : node.id === 'N2'
          ? { ...node, y: 3 }
          : node.id === 'N3'
            ? { ...node, z: 4 }
            : node),
      members: candidate.members.map((member) => member.id === 'M3' ? { ...member, type: 'truss' as const } : member),
      nodalLoads: candidate.nodalLoads.map((load) => load.id === 'NL1' ? { ...load, fz: 9 } : load),
    };

    const review = prepareSpace3DSyncReview(source, current, edited);
    const pick = (kind: string, id: string, field: string) => review.patches.find((patch) => patch.entityKind === kind && patch.entityId === id && patch.field === field);

    expect(pick('node', 'N1', 'x')).toMatchObject({ before: 0, after: 2, compatibility: 'exact', state: 'conflict' });
    expect(pick('node', 'N2', 'y')).toMatchObject({ before: 0, after: 3, compatibility: 'exact', state: 'ready' });
    expect(pick('node', 'N3', 'z')).toMatchObject({ before: 0, after: 4, compatibility: 'unsupported', state: 'unsupported' });
    expect(pick('member', 'M3', 'type')).toMatchObject({ before: 'frame', after: 'truss', compatibility: 'requires-review', state: 'ready' });
    expect(pick('nodal-load', 'NL1', 'fz')).toMatchObject({ before: 0, after: 9, compatibility: 'unsupported', state: 'unsupported' });

    const approved = review.patches.filter((patch) => patch.entityId === 'N2' || patch.entityId === 'N3').map((patch) => patch.patchId);
    const applied = applyApprovedSpace3DSync(current, review, approved);
    expect(applied.nodes.find((node) => node.id === 'N2')?.y).toBe(3);
    expect(applied.nodes.find((node) => node.id === 'N3')).toMatchObject({ x: 0, y: 4 });
  });
});
