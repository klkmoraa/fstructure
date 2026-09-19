import { expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { createSolverSnapshot, map2DSelection } from './toolSnapshot';

it('maps multi-selection to neutral scoped references without modifying the selection', () => {
  const selection = { kind: 'multi' as const, nodeIds: ['n1'], memberIds: ['m1'] };
  expect(map2DSelection('p1', selection)).toEqual([
    { projectId: 'p1', tool: 'model2d', kind: 'node', id: 'n1' },
    { projectId: 'p1', tool: 'model2d', kind: 'member', id: 'm1' },
  ]);
  expect(selection).toEqual({ kind: 'multi', nodeIds: ['n1'], memberIds: ['m1'] });
});
it('does not publish failed analyses as snapshots', () => {
  const project = createBlankProject();
  expect(createSolverSnapshot(project, 'source-1', analyzeProject(project))).toBeNull();
});

it('publishes immutable versioned numerical evidence with conservative diagnostic reliability', () => {
  const project = createDefaultProject();
  const result = analyzeProject(project);
  const snapshot = createSolverSnapshot(project, 'source-17', result)!;
  expect(snapshot.sourceVersion).toBe('source-17');
  expect(snapshot.reliability).toBe('reliable');
  expect(snapshot.result.nodeResults).toEqual(result.nodeResults);
  expect(Object.isFrozen(snapshot.result.nodeResults)).toBe(true);
  expect(Object.isFrozen(snapshot.model.nodes[0])).toBe(true);
  project.nodes[0].x = 999;
  expect(snapshot.model.nodes[0].x).toBe(0);
  const unreliable = createSolverSnapshot(project, 'source-18', { ...result, reliability: { ...result.reliability!, level: 'unreliable' } });
  expect(unreliable?.reliability).toBe('unreliable');
  expect(createSolverSnapshot(project, 'source-19', { ...result, reliability: undefined })?.reliability).toBe('unreliable');
});
