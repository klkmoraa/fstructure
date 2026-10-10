import { describe, expect, it } from 'vitest';
import type { ModelDemandSnapshot, ModelResultProvider } from '../../../design/elements/modelResultSnapshot';
import { originForElement, originState, withElementOrigin, type LinkedPieceOrigin } from './LinkedPieceOrigin';

const snapshot: ModelDemandSnapshot = { version: 1, source: { kind: 'model3d', projectId: 'p', revision: 'r1', memberId: 'C1', axisId: 'x:0' },
  target: { id: 'LC1', label: 'LC1', kind: 'case', factors: [] }, station: { xM: 1, side: 'right', lengthM: 3 }, units: 'kN-m',
  axes: { convention: 'local', localBasis: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] }, actions: { nKn: -1, vyKn: 0, vzKn: 0, torsionKnm: 0, myKnm: 2, mzKnm: 3 },
  member: { id: 'C1', label: 'C1', family: 'column', levelId: 'L1', axisIds: ['x:0'], lengthM: 3, section: { shape: 'rectangular', widthMm: 300, depthMm: 500, fcMpa: 25, materialLabel: 'C25' }, start: [0, 0, 0], end: [0, 3, 0] } };
const origin: LinkedPieceOrigin = { version: 1, snapshot, copiedFields: { axial: '1', momentX: '3' } };
const provider = (revision = 'r1'): ModelResultProvider => ({ inventory: { projectId: 'p', kind: 'model3d', revision, targets: [snapshot.target], members: [snapshot.member], supports: [], levels: [] }, member: async () => snapshot, support: async () => { throw new Error(); } });

describe('linked piece origin', () => {
  it('detects current and stale source revisions, missing provider and edited copied actions', () => {
    expect(originState(origin, provider(), { axial: '1', momentX: '3' })).toEqual({ source: 'current', edited: false });
    expect(originState(origin, provider('r2'), { axial: '1', momentX: '3' }).source).toBe('stale');
    expect(originState(origin, null, { axial: '2', momentX: '3' })).toEqual({ source: 'unavailable', edited: true });
    expect(originState(origin, provider(), { axial: '2', momentX: '3' }).edited).toBe(true);
  });
  it('keeps origins separate by draft element and clears only the requested one', () => {
    const both = withElementOrigin(withElementOrigin(undefined, 'column', origin), 'flexure', { ...origin, copiedFields: { moment: '3' } });
    expect(originForElement(both, 'column')).toEqual(origin);
    const columnOnly = withElementOrigin(both, 'flexure', undefined);
    expect(originForElement(columnOnly, 'column')).toEqual(origin);
    expect(originForElement(columnOnly, 'flexure')).toBeUndefined();
  });
});
