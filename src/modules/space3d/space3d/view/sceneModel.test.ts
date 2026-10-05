import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from '../engine/solver';
import { axialCantilever, bendingCantilever } from '../engine/fixtures';
import { buildSpace3DSceneModel } from './sceneModel';
import { generateSpace3DBuilding } from '../engine/buildingTemplate';

describe('Space 3D result scene', () => {
  it('maps current axial actions to each analytical member', () => {
    const project = axialCantilever({ P: 12 });
    const analysis = analyzeSpace3DProject(project, 'LC1');
    const scene = buildSpace3DSceneModel({
      project, analysis, analysisState: 'ready', selection: null, targetId: 'LC1', resultMode: 'axial',
    });

    expect(scene.members[0].result?.mode).toBe('axial');
    expect(scene.members[0].result?.magnitude).toBeCloseTo(12);
    expect(scene.members[0].result?.relative).toBe(1);
  });

  it('does not publish stale result color or reactions', () => {
    const project = bendingCantilever({ P: 9 });
    const analysis = analyzeSpace3DProject(project, 'LC1');
    const scene = buildSpace3DSceneModel({
      project, analysis, analysisState: 'stale', selection: null, targetId: 'LC1', resultMode: 'reactions',
    });

    expect(scene.members.every((member) => member.result === null)).toBe(true);
    expect(scene.reactions).toEqual([]);
  });
});

describe('Space 3D ETABS-style scene', () => {
  const building = () => generateSpace3DBuilding({ xSpacings: [6], zSpacings: [5], storyHeights: [3, 3], superDeadLoad: 2, liveLoad: 0 });

  it('draws positive M3 below a beam, on the tension side, with a parabolic sagging peak', () => {
    const project = building();
    const analysis = analyzeSpace3DProject(project, 'DEAD');
    const scene = buildSpace3DSceneModel({ project, analysis, analysisState: 'ready', selection: null, targetId: 'DEAD', resultMode: 'moment' });
    const beam = scene.members.find((member) => member.role === 'beam' && member.diagram)!;
    expect(beam.diagram!.component).toBe('Mz');
    expect(beam.diagram!.direction[1]).toBeCloseTo(-1, 9);
    const mid = beam.diagram!.stations.reduce((best, station) => (Math.abs(station.x - beam.length / 2) < Math.abs(best.x - beam.length / 2) ? station : best));
    expect(mid.value).toBeGreaterThan(0);
    expect(scene.diagram?.scale).toBeGreaterThan(0);
  });

  it('shows only one story in plan and rotates vertical diagrams into the plan plane', () => {
    const project = building();
    const analysis = analyzeSpace3DProject(project, 'DEAD');
    const scene = buildSpace3DSceneModel({
      project, analysis, analysisState: 'ready', selection: null, targetId: 'DEAD', resultMode: 'moment',
      scope: { kind: 'plan', storyId: 'S1', elevation: 3 },
    });
    const inPlan = scene.members.filter((member) => member.inScope);
    expect(inPlan.length).toBe(4);
    expect(inPlan.every((member) => member.role === 'beam')).toBe(true);
    for (const member of inPlan) expect(Math.abs(member.diagram!.direction[1])).toBeLessThan(1e-9);
    expect(scene.nodes.filter((node) => node.inScope)).toHaveLength(4);
    expect(scene.grid?.elevation).toBe(3);
  });

  it('treats round-off as zero instead of scaling noise to a diagram', () => {
    const project = axialCantilever({ P: 10 });
    const analysis = analyzeSpace3DProject(project, 'LC1');
    const scene = buildSpace3DSceneModel({ project, analysis, analysisState: 'ready', selection: null, targetId: 'LC1', resultMode: 'moment' });
    expect(scene.diagram).toBeNull();
    expect(scene.members[0].diagram?.maxAbs).toBe(0);
  });

  it('resolves member loads and sections for drawing', () => {
    const project = building();
    const scene = buildSpace3DSceneModel({ project, analysis: null, analysisState: 'idle', selection: null, targetId: 'DEAD' });
    expect(scene.memberLoads?.length).toBeGreaterThan(0);
    expect(scene.memberLoads?.every((load) => load.points.every((sample) => sample.vector[1] <= 0))).toBe(true);
    const column = scene.members.find((member) => member.role === 'column')!;
    expect(column.section).toMatchObject({ shape: 'I', depth: expect.any(Number) });
  });
});
