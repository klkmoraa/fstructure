import { describe, expect, it } from 'vitest';
import { applySpace3DCommand } from '../../space3d/data/commands';
import { generateSpace3DBuilding } from '../../space3d/engine/buildingTemplate';
import { analyzeSpace3DProject } from '../../space3d/engine/solver';
import { fixedSpace3DRestraints } from '../../space3d/model/types';
import {
  EMPTY_SPACE3D_SELECTION, applySpace3DPick, applySpace3DWindow, space3DAssignDistributedLoadCommand, space3DAssignNodalLoadCommand,
  space3DAssignReleasesCommand, space3DAssignRestraintsCommand, space3DAssignSectionCommand, space3DDeleteSelectionCommand,
  SPACE3D_RELEASE_PRESETS,
} from './space3dAssign';

const building = () => generateSpace3DBuilding({ xSpacings: [6], zSpacings: [5], storyHeights: [3], superDeadLoad: 0, liveLoad: 0 });

describe('Space3D selection', () => {
  it('replaces on a plain click and toggles with a modifier', () => {
    let selection = applySpace3DPick(EMPTY_SPACE3D_SELECTION, { kind: 'member', id: 'B1' }, false);
    selection = applySpace3DPick(selection, { kind: 'member', id: 'B2' }, true);
    selection = applySpace3DPick(selection, { kind: 'node', id: 'A1-0' }, true);
    expect(selection).toEqual({ nodes: ['A1-0'], members: ['B1', 'B2'] });
    selection = applySpace3DPick(selection, { kind: 'member', id: 'B1' }, true);
    expect(selection.members).toEqual(['B2']);
    expect(applySpace3DPick(selection, null, false)).toEqual(EMPTY_SPACE3D_SELECTION);
    expect(applySpace3DWindow(selection, { nodes: ['A1-0', 'B1-0'], members: [] }, true).nodes).toEqual(['A1-0', 'B1-0']);
  });
});

describe('Space3D assign', () => {
  it('assigns a catalog section with its material and density in one undoable step', () => {
    const project = building();
    const beams = project.members.filter((member) => member.id.startsWith('B')).map((member) => member.id);
    const command = space3DAssignSectionCommand(beams, 'W18x50')!;
    const next = applySpace3DCommand(project, command);
    const beam = next.members.find((member) => member.id === beams[0])!;
    expect(beam).toMatchObject({ sectionId: 'W18x50', materialId: 'steel-gr50', density: 7850, sectionOrigin: 'catalog' });
    expect(command.kind).toBe('batch');
  });

  it('pins beam ends and removes the releases again', () => {
    const project = building();
    const pinned = applySpace3DCommand(project, space3DAssignReleasesCommand(project, ['B1'], SPACE3D_RELEASE_PRESETS['pinned-both'])!);
    expect(pinned.members.find((member) => member.id === 'B1')?.releases).toEqual({ iRy: true, iRz: true, jRy: true, jRz: true });
    const continuous = applySpace3DCommand(pinned, space3DAssignReleasesCommand(pinned, ['B1'], undefined)!);
    expect(continuous.members.find((member) => member.id === 'B1')?.releases).toBeUndefined();
    expect(analyzeSpace3DProject(pinned, 'DEAD').success).toBe(true);
  });

  it('adds and replaces a gravity load on the selected beams', () => {
    const project = building();
    const added = applySpace3DCommand(project, space3DAssignDistributedLoadCommand(project, ['B1', 'B2'], { caseId: 'LIVE', direction: 'gravity', value: 12, mode: 'add' })!);
    expect(added.memberLoads.filter((load) => load.caseId === 'LIVE')).toHaveLength(2);
    expect(added.memberLoads[0]).toMatchObject({ qyStart: -12, coordinateSystem: 'global' });
    const replaced = applySpace3DCommand(added, space3DAssignDistributedLoadCommand(added, ['B1', 'B2'], { caseId: 'LIVE', direction: 'gravity', value: 5, mode: 'replace' })!);
    expect(replaced.memberLoads.filter((load) => load.caseId === 'LIVE').map((load) => load.qyStart)).toEqual([-5, -5]);
    const result = analyzeSpace3DProject(replaced, 'LIVE');
    const total = result.nodeResults.reduce((sum, node) => sum + node.reaction.uy, 0);
    const length = (id: string) => {
      const member = replaced.members.find((item) => item.id === id)!;
      const i = replaced.nodes.find((node) => node.id === member.i)!;
      const j = replaced.nodes.find((node) => node.id === member.j)!;
      return Math.hypot(j.x - i.x, j.y - i.y, j.z - i.z);
    };
    expect(total).toBeCloseTo(5 * (length('B1') + length('B2')), 8);
  });

  it('assigns nodal loads and supports to many nodes at once', () => {
    const project = building();
    const top = project.nodes.filter((node) => node.y > 0).map((node) => node.id);
    const loaded = applySpace3DCommand(project, space3DAssignNodalLoadCommand(project, top, 'LIVE', { fx: 5, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 }, 'add')!);
    expect(loaded.nodalLoads.filter((load) => load.caseId === 'LIVE')).toHaveLength(top.length);
    const supported = applySpace3DCommand(loaded, space3DAssignRestraintsCommand(top.slice(0, 1), fixedSpace3DRestraints())!);
    expect(supported.nodes.find((node) => node.id === top[0])?.restraints.rz).toBe(true);
  });

  it('deletes members with their loads and keeps nodes still in use', () => {
    const project = applySpace3DCommand(building(), space3DAssignDistributedLoadCommand(building(), ['B1'], { caseId: 'LIVE', direction: 'gravity', value: 3, mode: 'add' })!);
    const b1 = project.members.find((member) => member.id === 'B1')!;
    const { command, keptNodes } = space3DDeleteSelectionCommand(project, { nodes: [b1.i], members: ['B1'] });
    const next = applySpace3DCommand(project, command!);
    expect(next.members.some((member) => member.id === 'B1')).toBe(false);
    expect(next.memberLoads.some((load) => load.memberId === 'B1')).toBe(false);
    expect(keptNodes).toEqual([b1.i]);
    expect(next.nodes.some((node) => node.id === b1.i)).toBe(true);
  });
});
