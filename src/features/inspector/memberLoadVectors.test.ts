import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import { pointLoadPolarFromVector, pointLoadVectorFromPolar, splitPointLoadIntoComponents } from './memberLoadVectors';

const pointProject = (): ProjectModel => ({
  id: 'P', name: 'P', schemaVersion: 1, settings: createDefaultSettings(), nodes: [], members: [], nodalLoads: [], combinations: [],
  memberLoads: [{ id: 'P1', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 3, py: -4 }],
  loadCases: [{ id: 'LC1', name: 'Caso', active: true, category: 'permanent' }],
});

describe('member point-load vectors', () => {
  it('round-trips a magnitude and direction', () => {
    const vector = pointLoadVectorFromPolar(5, -53.1301023542);
    const polar = pointLoadPolarFromVector(vector.px, vector.py);
    expect(polar.magnitude).toBeCloseTo(5);
    expect(polar.angleDeg).toBeCloseTo(-53.1301023542);
  });

  it('splits a diagonal load into equivalent components at the same station', () => {
    const result = splitPointLoadIntoComponents(pointProject(), 'P1');
    expect(result.project.memberLoads).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: result.horizontalId, px: 3, py: 0, position: 0.5 }),
      expect.objectContaining({ id: result.verticalId, px: 0, py: -4, position: 0.5 }),
    ]));
  });
});
