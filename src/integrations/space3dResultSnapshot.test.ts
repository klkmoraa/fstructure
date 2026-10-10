import { describe, expect, it } from 'vitest';
import { createBlankSpace3DProject } from '../modules/space3d/space3d/model/defaultProject';
import { fixedSpace3DRestraints, freeSpace3DRestraints, type Space3DFrameMember, type Space3DProjectV1 } from '../modules/space3d/space3d/model/types';
import { analyzeSpace3dSupport, analyzeSpace3dTarget, space3dResultInventory } from './space3dResultSnapshot';

function cantilever(): Space3DProjectV1 {
  const base = createBlankSpace3DProject();
  const nodes = [
    { id: 'A', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
    { id: 'B', x: 3, y: 4, z: 0, restraints: freeSpace3DRestraints() },
  ];
  const member: Space3DFrameMember = { id: 'M1', i: 'A', j: 'B', E: 25e6, G: 10e6, A: 0.06, Iy: 0.00045, Iz: 0.00045, J: 0.0007,
    orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 }, sectionId: 'custom-shape', materialId: 'concrete-fc30' };
  return { ...base, id: 'inclined-cantilever', name: 'Voladizo inclinado', nodes, members: [member],
    loadCases: [{ id: 'LC1', name: 'LC1', active: true }],
    nodalLoads: [{ id: 'P', caseId: 'LC1', nodeId: 'B', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 }],
    loadCombinations: [{ id: 'U2', name: 'U2', terms: [{ caseId: 'LC1', factor: 2 }] }] };
}

describe('modelo 3D: inventario y demanda nativa', () => {
  it('retiene orientación local, estaciones y reacciones globales por objetivo', () => {
    const model = cantilever();
    const inventory = space3dResultInventory(model);
    expect(inventory.supports.map((item) => item.id)).toEqual(['A']);
    const axisId = inventory.members[0]!.axisIds[0];
    expect(axisId).toBe('z:0');
    expect(inventory.members[0]!.section).toMatchObject({ shape: 'other', widthMm: null, depthMm: null });
    const snapshot = analyzeSpace3dTarget(model, inventory, { memberId: 'M1', targetId: 'LC1', xM: 1, side: 'right', axisId });
    expect(snapshot.axes.convention.length).toBeLessThanOrEqual(256);
    snapshot.axes.localBasis[0]!.forEach((value, index) => expect(value).toBeCloseTo([0.6, 0.8, 0][index]!, 12));
    snapshot.axes.localBasis[1]!.forEach((value, index) => expect(value).toBeCloseTo([-0.8, 0.6, 0][index]!, 12));
    snapshot.axes.localBasis[2]!.forEach((value, index) => expect(value).toBeCloseTo([0, 0, 1][index]!, 12));
    expect(snapshot.actions.nKn).toBeCloseTo(-8, 7);
    expect(snapshot.actions.vyKn).toBeCloseTo(-6, 7);
    expect(snapshot.actions.mzKnm).toBeCloseTo(-24, 7);
    const serviceReaction = analyzeSpace3dSupport(model, inventory, { nodeId: 'A', targetId: 'LC1' }).reactionGlobal;
    const ultimateReaction = analyzeSpace3dSupport(model, inventory, { nodeId: 'A', targetId: 'U2' }).reactionGlobal;
    expect(serviceReaction.fyKn).toBeCloseTo(10, 7); expect(serviceReaction.mzKnm).toBeCloseTo(30, 7);
    expect(ultimateReaction.fyKn).toBeCloseTo(20, 7); expect(ultimateReaction.mzKnm).toBeCloseTo(60, 7);
  });

  it('usa la sección de catálogo sólo cuando A/I/J coinciden y conserva fuerzas concurrentes locales y globales', () => {
    const base = createBlankSpace3DProject();
    const model: Space3DProjectV1 = {
      ...base, id: 'catalog-column', name: 'Columna catálogo',
      nodes: [
        { id: 'A', x: 0, y: 0, z: 0, restraints: fixedSpace3DRestraints() },
        { id: 'B', x: 0, y: 3, z: 0, restraints: freeSpace3DRestraints() },
      ],
      members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 23_500_000, G: 9_800_000, A: 0.15, Iy: 0.001125, Iz: 0.003125, J: 0.003,
        orientation: { localYReferenceGlobal: [0, 0, 1], rollRadians: 0 }, materialId: 'concrete-fc25', materialOrigin: 'catalog', sectionId: 'Concreto 30x50 cm', sectionOrigin: 'catalog' }],
      loadCases: [{ id: 'LC1', name: 'LC1', active: true }],
      nodalLoads: [{ id: 'P', caseId: 'LC1', nodeId: 'B', fx: 10, fy: -200, fz: 5, mx: 0, my: 0, mz: 0 }],
      loadCombinations: [{ id: 'U2', name: 'U2', terms: [{ caseId: 'LC1', factor: 2 }] }],
    };
    const inventory = space3dResultInventory(model);
    expect(inventory.supports.map((item) => item.id)).toEqual(['A']);
    expect(inventory.members[0]!.section).toMatchObject({ shape: 'rectangular', widthMm: 300, depthMm: 500, fcMpa: 25 });
    const snapshot = analyzeSpace3dTarget(model, inventory, { memberId: 'AB', targetId: 'LC1', xM: 1, side: 'right' });
    expect(snapshot.actions.nKn).toBeCloseTo(-200, 7);
    expect(snapshot.actions.vyKn).toBeCloseTo(5, 7);
    expect(snapshot.actions.vzKn).toBeCloseTo(10, 7);
    expect(snapshot.actions.myKnm).toBeCloseTo(-20, 7);
    expect(snapshot.actions.mzKnm).toBeCloseTo(10, 7);
    const reaction = analyzeSpace3dSupport(model, inventory, { nodeId: 'A', targetId: 'LC1' }).reactionGlobal;
    expect(reaction.fxKn).toBeCloseTo(-10, 7); expect(reaction.fyKn).toBeCloseTo(200, 7);
    expect(reaction.fzKn).toBeCloseTo(-5, 7); expect(reaction.mxKnm).toBeCloseTo(-15, 7);
    expect(reaction.myKnm).toBeCloseTo(0, 7); expect(reaction.mzKnm).toBeCloseTo(30, 7);
    const changed = { ...model, members: [{ ...model.members[0]!, J: 0.004 }] };
    expect(space3dResultInventory(changed).members[0]!.section).toMatchObject({ shape: 'other', widthMm: null, depthMm: null });
  });

  it('clasifica HSS cajón y tubo circular huecos como other sin borrar su rótulo ni material', () => {
    const cases = [
      { id: 'HSS 100x100x4', shapeId: 'HSS 100x100x4', A: 0.0015, Iy: 2.3e-6, Iz: 2.3e-6, J: 3.56e-6 },
      { id: 'Tubo Ø 88.9x3.2', shapeId: 'Tubo Ø 88.9x3.2', A: 0.00086, Iy: 7.95e-7, Iz: 7.95e-7, J: 1.59e-6 },
    ];
    for (const section of cases) {
      const model = cantilever();
      const record = space3dResultInventory({ ...model, members: [{ ...model.members[0]!, label: section.id, sectionId: section.shapeId,
        sectionOrigin: 'catalog', materialId: 'steel-a36', materialOrigin: 'catalog', E: 200_000_000, G: 77_000_000,
        A: section.A, Iy: section.Iy, Iz: section.Iz, J: section.J }] }).members[0]!;
      expect(record.label).toBe(section.id);
      expect(record.section).toMatchObject({ shape: 'other', widthMm: null, depthMm: null, materialLabel: 'Acero ASTM A36 (preset elástico)' });
    }
  });

  it('deduplica geométricamente las barras en ejes X y Z, y cambia revisión al editar cargas', () => {
    const model = cantilever();
    const modelWithAxes: Space3DProjectV1 = {
      ...model,
      nodes: [...model.nodes, { id: 'C', x: 3, y: 5, z: 0, restraints: freeSpace3DRestraints() },
        { id: 'D', x: 5, y: 5, z: 0, restraints: freeSpace3DRestraints() }, { id: 'E', x: 3, y: 5, z: 2, restraints: freeSpace3DRestraints() }],
      members: [...model.members,
        { ...model.members[0]!, id: 'vertical', i: 'B', j: 'C' },
        { ...model.members[0]!, id: 'grid-z', i: 'C', j: 'D' },
        { ...model.members[0]!, id: 'grid-x', i: 'C', j: 'E' }],
    };
    const inventory = space3dResultInventory(modelWithAxes);
    const column = inventory.members.find((item) => item.id === 'vertical')!;
    expect(column.family).toBe('column');
    expect(column.axisIds).toHaveLength(2);
    expect(new Set(column.axisIds).size).toBe(2);
    const revision = inventory.revision;
    const edited: Space3DProjectV1 = { ...modelWithAxes, nodalLoads: [{ ...modelWithAxes.nodalLoads[0]!, fy: -11 }] };
    expect(space3dResultInventory(edited).revision).not.toBe(revision);
  });

  it('rechaza objetivos, estaciones y ejes que no corresponden', () => {
    const model = cantilever();
    const inventory = space3dResultInventory(model);
    expect(() => analyzeSpace3dTarget(model, inventory, { memberId: 'M1', targetId: 'missing', xM: 1, side: 'right' })).toThrow(/objetivo/);
    expect(() => analyzeSpace3dTarget(model, inventory, { memberId: 'M1', targetId: 'LC1', xM: 5.1, side: 'right' })).toThrow(/fuera/);
    expect(() => analyzeSpace3dTarget(model, inventory, { memberId: 'M1', targetId: 'LC1', xM: 1, side: 'right', axisId: 'x:50' })).toThrow(/pertenece/);
  });

  it('rechaza un objetivo si falla el análisis en vez de devolver ceros plausibles', () => {
    const model = cantilever();
    const unsupported = { ...model, nodes: model.nodes.map((node) => ({ ...node, restraints: freeSpace3DRestraints() })) };
    const inventory = space3dResultInventory(unsupported);
    expect(() => analyzeSpace3dTarget(unsupported, inventory, { memberId: 'M1', targetId: 'LC1', xM: 1, side: 'right' })).toThrow(/no pudo resolver/);
  });
});
