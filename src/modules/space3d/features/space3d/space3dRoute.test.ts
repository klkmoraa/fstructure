import { describe, expect, it } from 'vitest';
import { deriveSpace3DGuide } from './space3dRoute';
import { createBlankSpace3DProject } from '../../space3d/model/defaultProject';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import { freeSpace3DRestraints, type Space3DProjectV1 } from '../../space3d/model/types';

const withoutSupports = (project: Space3DProjectV1): Space3DProjectV1 => ({
  ...project,
  nodes: project.nodes.map((node) => ({ ...node, restraints: freeSpace3DRestraints() })),
});

const frame = () => generateSpace3DFrame({ baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4 });

describe('deriveSpace3DGuide', () => {
  it('asks to start when the model is empty', () => {
    const guide = deriveSpace3DGuide(createBlankSpace3DProject(), 'idle');
    expect(guide.next).toBe('start');
    expect(guide.steps.map((step) => step.state)).toEqual(['current', 'pending', 'pending', 'pending']);
  });

  it('proposes the lowest node for supports once geometry exists', () => {
    const project = withoutSupports(frame());
    const guide = deriveSpace3DGuide(project, 'idle');
    expect(guide.next).toBe('add-support');
    const lowest = Math.min(...project.nodes.map((node) => node.y));
    expect(project.nodes.find((node) => node.id === guide.nodeId)?.y).toBe(lowest);
    expect(guide.steps[0]!.state).toBe('done');
    expect(guide.steps[1]!.state).toBe('current');
  });

  it('offers the analysis once geometry, supports, and loads exist', () => {
    const project = frame();
    expect(project.nodalLoads.length).toBeGreaterThan(0);
    expect(deriveSpace3DGuide(project, 'idle').next).toBe('analyze');
  });

  it('follows the analysis lifecycle without touching the model', () => {
    const project = frame();
    expect(deriveSpace3DGuide(project, 'running').next).toBe('running');
    expect(deriveSpace3DGuide(project, 'failed').next).toBe('review-failure');
    expect(deriveSpace3DGuide(project, 'stale').next).toBe('reanalyze');
    const ready = deriveSpace3DGuide(project, 'ready');
    expect(ready.next).toBe('explore-results');
    expect(ready.steps.every((step) => step.state === 'done')).toBe(true);
  });
});
