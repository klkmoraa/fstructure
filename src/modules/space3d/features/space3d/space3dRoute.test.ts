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
    const guide = deriveSpace3DGuide(createBlankSpace3DProject(), 'idle', 0);
    expect(guide.next).toBe('start');
    expect(guide.steps.map((step) => step.state)).toEqual(['current', 'pending', 'pending', 'pending']);
  });

  it('proposes the lowest node for supports once geometry exists', () => {
    const project = withoutSupports(frame());
    const guide = deriveSpace3DGuide(project, 'idle', 0);
    expect(guide.next).toBe('add-support');
    const lowest = Math.min(...project.nodes.map((node) => node.y));
    expect(project.nodes.find((node) => node.id === guide.nodeId)?.y).toBe(lowest);
    expect(guide.steps[0]!.state).toBe('done');
    expect(guide.steps[1]!.state).toBe('current');
  });

  it('blocks on bridge notes before offering the analysis', () => {
    const project = frame();
    expect(project.nodalLoads.length).toBeGreaterThan(0);
    expect(deriveSpace3DGuide(project, 'idle', 2).next).toBe('resolve-bridge');
    expect(deriveSpace3DGuide(project, 'idle', 0).next).toBe('analyze');
  });

  it('follows the analysis lifecycle without touching the model', () => {
    const project = frame();
    expect(deriveSpace3DGuide(project, 'running', 0).next).toBe('running');
    expect(deriveSpace3DGuide(project, 'failed', 0).next).toBe('review-failure');
    expect(deriveSpace3DGuide(project, 'stale', 0).next).toBe('reanalyze');
    const ready = deriveSpace3DGuide(project, 'ready', 0);
    expect(ready.next).toBe('explore-results');
    expect(ready.steps.every((step) => step.state === 'done')).toBe(true);
  });
});
