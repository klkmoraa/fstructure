import { describe, expect, it } from 'vitest';
import { applySpace3DCommand } from '../../space3d/data/commands';
import { createBlankSpace3DProject } from '../../space3d/model/defaultProject';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import {
  buildSpace3DNode, space3DBaseNodeIds, space3DLoadCommand, space3DMemberToPointCommand,
  space3DPlaneAxisForView, space3DSupportCommand, space3DTopNodeIds, snapToWorkPlane,
} from './space3dModeling';

const frame = () => generateSpace3DFrame({ baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4 });

describe('plano de trabajo', () => {
  it('snaps the in-plane coordinates and pins the plane coordinate', () => {
    expect(snapToWorkPlane([1.26, 7.9, -0.74], { axis: 'y', offset: 3, step: 0.5 })).toEqual([1.5, 3, -0.5]);
    expect(snapToWorkPlane([2.9999999, 1.1, 5], { axis: 'z', offset: 0, step: 1 })).toEqual([3, 1, 0]);
  });

  it('never returns a negative zero', () => {
    expect(Object.is(snapToWorkPlane([-0.1, 0, 0], { axis: 'y', offset: 0, step: 1 })[0], 0)).toBe(true);
  });

  it('follows the camera: plan is horizontal, elevations are vertical', () => {
    expect(space3DPlaneAxisForView('isometric')).toBe('y');
    expect(space3DPlaneAxisForView('top')).toBe('y');
    expect(space3DPlaneAxisForView('front')).toBe('z');
    expect(space3DPlaneAxisForView('side')).toBe('x');
  });
});

describe('barra hasta un punto', () => {
  it('creates the end node and the member as one undoable step', () => {
    const project = applySpace3DCommand(createBlankSpace3DProject(), { kind: 'add-node', node: buildSpace3DNode(createBlankSpace3DProject(), [0, 0, 0]) });
    const result = space3DMemberToPointCommand(project, project.nodes[0]!, [0, 3, 0], { kind: 'catalog', sectionName: 'HEB 200' })!;
    expect(result.command.kind).toBe('batch');
    const next = applySpace3DCommand(project, result.command);
    expect(next.nodes).toHaveLength(2);
    const member = next.members[0]!;
    expect([member.i, member.j]).toEqual(['N1', result.endNodeId]);
    expect(member.sectionId).toBe('HEB 200');
    expect(member.materialOrigin).toBe('catalog');
    expect(member.density).toBeGreaterThan(0);
  });

  it('reuses a node already at that point instead of duplicating it', () => {
    const project = frame();
    const [a, b] = project.nodes;
    const result = space3DMemberToPointCommand(project, a!, [b!.x, b!.y, b!.z], { kind: 'reference' })!;
    expect(result.command.kind).toBe('add-member');
    expect(result.endNodeId).toBe(b!.id);
  });

  it('refuses a member from a node to itself', () => {
    const project = frame();
    const a = project.nodes[0]!;
    expect(space3DMemberToPointCommand(project, a, [a.x, a.y, a.z], { kind: 'reference' })).toBeNull();
  });
});

describe('apoyos y cargas en grupo', () => {
  it('finds the base and the top level of a frame', () => {
    const project = frame();
    const base = space3DBaseNodeIds(project);
    const top = space3DTopNodeIds(project);
    expect(base).toHaveLength(4);
    expect(top).toHaveLength(4);
    expect(base.some((id) => top.includes(id))).toBe(false);
  });

  it('supports the whole base in a single step', () => {
    const project = frame();
    const next = applySpace3DCommand(project, space3DSupportCommand(space3DBaseNodeIds(project), 'pinned')!);
    for (const id of space3DBaseNodeIds(project)) {
      expect(next.nodes.find((node) => node.id === id)!.restraints).toMatchObject({ ux: true, uy: true, uz: true, rx: false });
    }
  });

  it('loads every top node downwards with unique ids', () => {
    const project = frame();
    const top = space3DTopNodeIds(project);
    const next = applySpace3DCommand(project, space3DLoadCommand(project, top, project.loadCases[0]!.id, 'down', 12)!);
    const added = next.nodalLoads.slice(project.nodalLoads.length);
    expect(added).toHaveLength(top.length);
    expect(new Set(next.nodalLoads.map((load) => load.id)).size).toBe(next.nodalLoads.length);
    expect(added.every((load) => load.fy === -12 && load.fx === 0 && load.fz === 0)).toBe(true);
  });
});
